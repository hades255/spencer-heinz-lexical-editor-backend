import { HTTP_RES_CODE } from '../shared/constants.js';
import { getDBPath, getFrontendPath, setFrontendPath } from '../shared/env.js';

const systemRouter = (fastify, opts, done) => {
    fastify.get('/env', async (request, reply) => {
        try {
            return reply.send({
                code: HTTP_RES_CODE.ERROR,
                data: {
                    dbpath: getDBPath(),
                    frontend: getFrontendPath(),
                },
                message: 'OK',
            });
        } catch (error) {
            console.log('system@get-error:', error);
            return reply.code(500).send({
                code: HTTP_RES_CODE.ERROR,
                data: { error },
                message: 'Unexpected Server Error Occured.',
            });
        }
    });

    fastify.post('/env', async (request, reply) => {
        try {
            const data = request.body;
            if (data.frontend) setFrontendPath(data.frontend);
            if (data.dbpath) setDBPath(data.dbpath);
            return reply.send({
                code: HTTP_RES_CODE.ERROR,
                message: 'OK',
            });
        } catch (error) {
            console.log('system@get-error:', error);
            return reply.code(500).send({
                code: HTTP_RES_CODE.ERROR,
                data: { error },
                message: 'Unexpected Server Error Occured.',
            });
        }
    });

    done();
};

export default systemRouter;
