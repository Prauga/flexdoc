from flask import Flask, jsonify
from prauga_flexdoc import setup_flask_flexdoc

app = Flask(__name__)


@app.get('/openapi.json')
def openapi():
    return jsonify({
        'openapi': '3.1.0',
        'info': {'title': 'Flask FlexDoc Example', 'version': '1.0.0'},
        'paths': {'/health': {'get': {'responses': {'200': {'description': 'OK'}}}}},
    })


@app.get('/health')
def health():
    return {'status': 'ok'}


setup_flask_flexdoc(app, '/docs', spec_url='/openapi.json', title='Flask FlexDoc Example')


if __name__ == '__main__':
    app.run(port=8001, debug=True)
