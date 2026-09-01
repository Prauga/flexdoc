from typing import Annotated

from fastapi import FastAPI, File, Form, Header, Query, Security, UploadFile
from fastapi.security import APIKeyHeader, HTTPBasic, HTTPBasicCredentials, HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from prauga_flexdoc import FlexDocASGI, FlexDocConfig

app = FastAPI(
    title="FlexDoc FastAPI Showcase API",
    description="Code-first OpenAPI 3.1 example covering servers, auth, parameters, JSON and multipart bodies with the FlexDoc 0.2 ASGI adapter.",
    version="2.2.0",
    docs_url=None,
    redoc_url=None,
    servers=[
        {"url": "http://localhost:8000", "description": "Local development"},
        {"url": "https://canary.api.example.test", "description": "Spot canary example"},
    ],
)

api_key = APIKeyHeader(name="X-API-Key", auto_error=False)
bearer = HTTPBearer(auto_error=False)
basic = HTTPBasic(auto_error=False)


class PetInput(BaseModel):
    name: str = Field(min_length=1, examples=["Miso"])
    age: int = Field(default=3, ge=0)
    tags: list[str] = Field(default_factory=lambda: ["friendly", "adoptable"])


class Pet(PetInput):
    id: str
    status: str = "available"


class SearchResult(BaseModel):
    terms: list[str]
    count: int


@app.get("/pets", response_model=list[Pet], tags=["Pets"], summary="List pets")
async def list_pets(
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    tags: Annotated[list[str] | None, Query()] = None,
    trace_id: Annotated[str | None, Header(alias="X-Trace-ID")] = None,
    _: Annotated[str | None, Security(api_key)] = None,
) -> list[Pet]:
    del limit, tags, trace_id
    return [Pet(id="pet-1", name="Miso", age=3, tags=["friendly", "adoptable"])]


@app.post("/pets", response_model=Pet, status_code=201, tags=["Pets"], summary="Create a pet")
async def create_pet(
    pet: PetInput,
    _: Annotated[HTTPAuthorizationCredentials | None, Security(bearer)] = None,
) -> Pet:
    return Pet(id="pet-new", **pet.model_dump())


@app.get("/pets/{pet_id}", response_model=Pet, tags=["Pets"], summary="Get a pet")
async def get_pet(pet_id: str) -> Pet:
    return Pet(id=pet_id, name="Miso", age=3, tags=["friendly"])


@app.get("/search", response_model=SearchResult, tags=["Search"], summary="Search the catalog")
async def search(terms: Annotated[list[str], Query()] = ["small", "friendly"]) -> SearchResult:
    return SearchResult(terms=terms, count=1)


@app.post("/sessions", tags=["Admin"], summary="Create a session")
async def create_session(
    credentials: Annotated[HTTPBasicCredentials | None, Security(basic)] = None,
    scope: Annotated[str, Form()] = "pets:write",
) -> dict[str, str]:
    username = credentials.username if credentials else "local"
    return {"token": f"{username}:{scope}"}


@app.post("/uploads", status_code=201, tags=["Forms"], summary="Upload a pet photo")
async def upload_photo(
    file: Annotated[UploadFile, File()],
    caption: Annotated[str, Form()] = "Miso at the park",
) -> dict[str, str]:
    return {"id": "upload-local", "filename": file.filename or "upload.bin", "caption": caption}


app.mount(
    "/docs",
    FlexDocASGI(
        FlexDocConfig(
            path="/docs",
            spec_url="/openapi.json",
            title="FlexDoc FastAPI showcase",
            theme="system",
            try_it_enabled=True,
        )
    ),
)
