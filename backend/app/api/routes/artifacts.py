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


def _get_artifact(
    session: SessionDep, current_user: CurrentUser, artifact_id: uuid.UUID
) -> Artifact:
    artifact = session.get(Artifact, artifact_id)
    if not artifact or artifact.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found"
        )
    return artifact


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
) -> Response:
    artifact = _get_artifact(session, current_user, artifact_id)

    if ARTIFACTS_STORAGE_DIR:
        root = Path(ARTIFACTS_STORAGE_DIR).resolve()
        candidate = (root / str(artifact.user_id) / artifact.path).resolve()
        try:
            candidate.relative_to(root)
            if candidate.is_file():
                filename = Path(artifact.path).name or f"{artifact.id}"
                return FileResponse(candidate, filename=filename)
        except ValueError:
            pass

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
