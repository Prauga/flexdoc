const express = require('express');
const swaggerJsdoc = require('swagger-jsdoc');
const { setupExpressFlexDoc } = require('@prauga/flexdoc-backend');

const app = express();

/**
 * @openapi
 * /hello/{name}:
 *   get:
 *     summary: Say hello
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Greeting
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
app.get('/hello/:name', (req, res) => res.json({ message: `Hello, ${req.params.name}!` }));

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.1.0',
    info: { title: 'FlexDoc Express example', version: '1.0.0' },
    servers: [{ url: 'http://localhost:3000' }],
  },
  apis: [__filename],
});

setupExpressFlexDoc(app, '/docs', {
  spec,
  options: { title: 'FlexDoc Express example', tryIt: { enabled: true } },
});

app.listen(3000, () => console.log('API: http://localhost:3000/hello/FlexDoc\nDocs: http://localhost:3000/docs'));
