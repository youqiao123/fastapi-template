from typing import Any

from fastapi import APIRouter, Query
from sqlmodel import SQLModel, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import Artifact, ArtifactCreate, ArtifactsPublic

router = APIRouter(prefix="/artifacts", tags=["artifacts"])


class ArtifactCreateMany(SQLModel):
    artifacts: list[ArtifactCreate]


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
