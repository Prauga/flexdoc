from fastapi import FastAPI
from pydantic import BaseModel
from prauga_flexdoc import FlexDocASGI, FlexDocConfig

app = FastAPI(
    title="FlexDoc FastAPI example",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
)


class Greeting(BaseModel):
    message: str


@app.get("/hello/{name}", response_model=Greeting, summary="Say hello")
async def hello(name: str) -> Greeting:
    return Greeting(message=f"Hello, {name}!")


app.mount(
    "/docs",
    FlexDocASGI(
        FlexDocConfig(
            path="/docs",
            spec_url="/openapi.json",
            title="FlexDoc FastAPI example",
        )
    ),
)
