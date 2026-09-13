#!/usr/bin/env python3

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'adapters' / 'python' / 'src'))

from fastapi import FastAPI
from prauga_flexdoc import setup_fastapi_flexdoc
import uvicorn

mode = os.getenv('FLEXDOC_BENCH_MODE', 'baseline')
port = int(os.getenv('FLEXDOC_BENCH_PORT', '5810'))
origin = os.getenv('FLEXDOC_BENCH_ORIGIN', f'http://127.0.0.1:{port}')

app = FastAPI(docs_url=None, redoc_url=None, openapi_url='/openapi.json')

@app.get('/health')
async def health():
    return {'ok': True}

@app.get('/target')
async def target():
    return {'ok': True, 'runtime': 'python-fastapi'}

if mode != 'baseline':
    options = dict(title='FlexDoc host-impact benchmark', try_it_default_server=origin)
    if mode == 'host':
        options.update(
            try_it_host_execution=True,
            try_it_host_execution_allowed_origins=[origin],
        )
    setup_fastapi_flexdoc(app, '/docs', **options)

if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=port, log_level='warning', access_log=False)
