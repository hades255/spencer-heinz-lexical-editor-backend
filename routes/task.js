import { fastifyPassport } from '../app.js';
import TaskModel from '../models/Task.js';
import { HTTP_RES_CODE } from '../shared/constants.js';

const taskRouter = (fastify, opts, done) => {
    fastify.post(
        '/',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                console.log(request.body);
                await new TaskModel(request.body).save();

                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
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
        },
    );

    done();
};

export default taskRouter;
