import json
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse, Response
from sqlmodel import SQLModel, func, select

from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.models import Artifact, ArtifactCreate, ArtifactsPublic, Message

router = APIRouter(prefix="/artifacts", tags=["artifacts"])
ARTIFACTS_STORAGE_DIR = settings.ARTIFACTS_STORAGE_DIR


class ArtifactCreateMany(SQLModel):
    artifacts: list[ArtifactCreate]


class ArtifactFile(SQLModel):
    name: str


class ArtifactFiles(SQLModel):
    data: list[ArtifactFile]
    count: int


def _get_artifact(
    session: SessionDep, current_user: CurrentUser, artifact_id: uuid.UUID
) -> Artifact:
    artifact = session.get(Artifact, artifact_id)
    if not artifact or artifact.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found"
        )
    return artifact


def _resolve_artifact_path(
    *, artifact: Artifact, current_user: CurrentUser, file_path: str | None = None
) -> Path | None:
    if not ARTIFACTS_STORAGE_DIR:
        return None

    root = Path(ARTIFACTS_STORAGE_DIR).resolve()
    base_dir = (root / str(current_user.id)).resolve()
    target_path = (base_dir / artifact.path).resolve()

    try:
        target_path.relative_to(base_dir)
    except ValueError:
        return None

    if file_path:
        subpath = Path(file_path)
        if subpath.is_absolute() or ".." in subpath.parts:
            return None
        target_path = (target_path / subpath).resolve()
        try:
            target_path.relative_to(base_dir)
        except ValueError:
            return None

    return target_path


# Support both /artifacts and /artifacts/ to avoid 307 redirects on missing slash
@router.get("", response_model=ArtifactsPublic, include_in_schema=False)
@router.get("/", response_model=ArtifactsPublic)
def read_artifacts(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    thread_id: str | None = Query(default=None),
) -> Any:
    count_statement = (
        select(func.count())
        .select_from(Artifact)
        .where(Artifact.user_id == current_user.id)
    )
    statement = (
        select(Artifact)
        .where(Artifact.user_id == current_user.id)
        .order_by(Artifact.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    if thread_id:
        count_statement = count_statement.where(Artifact.thread_id == thread_id)
        statement = statement.where(Artifact.thread_id == thread_id)

    count = session.exec(count_statement).one()
    artifacts = session.exec(statement).all()
    return ArtifactsPublic(data=artifacts, count=count)


@router.post("/bulk", response_model=ArtifactsPublic)
def create_artifacts(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    payload: ArtifactCreateMany,
) -> Any:
    if not payload.artifacts:
        return ArtifactsPublic(data=[], count=0)

    artifacts: list[Artifact] = []
    for artifact_in in payload.artifacts:
        artifact = Artifact.model_validate(
            artifact_in, update={"user_id": current_user.id}
        )
        artifacts.append(artifact)
        session.add(artifact)

    session.commit()
    for artifact in artifacts:
        session.refresh(artifact)

    return ArtifactsPublic(data=artifacts, count=len(artifacts))


@router.delete("/{artifact_id}", response_model=Message)
def delete_artifact(
    *, session: SessionDep, current_user: CurrentUser, artifact_id: uuid.UUID
) -> Message:
    artifact = _get_artifact(session, current_user, artifact_id)
    session.delete(artifact)
    session.commit()
    return Message(message="Artifact deleted successfully")


@router.get("/{artifact_id}/download")
def download_artifact(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    artifact_id: uuid.UUID,
    file_path: str | None = Query(default=None, max_length=255, alias="file_path"),
) -> Response:
    artifact = _get_artifact(session, current_user, artifact_id)

    candidate = _resolve_artifact_path(
        artifact=artifact, current_user=current_user, file_path=file_path
    )
    if candidate and candidate.is_file():
        filename = Path(file_path or artifact.path).name or f"{artifact.id}"
        return FileResponse(candidate, filename=filename)

    if artifact.is_folder and file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artifact file not found in folder",
        )

    fallback_content = json.dumps(
        {
            "id": str(artifact.id),
            "path": artifact.path,
            "asset_id": artifact.asset_id,
            "thread_id": artifact.thread_id,
            "note": "Artifact file not found on server; returning metadata instead.",
        }
    )
    filename = Path(artifact.path).name or f"{artifact.id}.json"
    return Response(
        content=fallback_content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{artifact_id}/files", response_model=ArtifactFiles)
def list_artifact_files(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    artifact_id: uuid.UUID,
    prefix: str | None = Query(default=None, max_length=255),
    suffix: str | None = Query(default=None, max_length=255),
) -> ArtifactFiles:
    artifact = _get_artifact(session, current_user, artifact_id)
    if not artifact.is_folder:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Artifact is not a folder",
        )

    folder_path = _resolve_artifact_path(artifact=artifact, current_user=current_user)
    if not folder_path or not folder_path.is_dir():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artifact folder not found",
        )

    files: list[ArtifactFile] = []
    for entry in folder_path.iterdir():
        if not entry.is_file():
            continue
        name = entry.name
        if prefix and not name.startswith(prefix):
            continue
        if suffix and not name.endswith(suffix):
            continue
        files.append(ArtifactFile(name=name))

    files.sort(key=lambda item: item.name)

    return ArtifactFiles(data=files, count=len(files))
