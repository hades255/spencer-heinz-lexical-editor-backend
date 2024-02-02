import { fastifyPassport } from '../app.js';
import TaskModel, { ReplySchema } from '../models/Task.js';
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
                await new TaskModel({
                    ...request.body,
                    lastActivity: { who: request.user.name, what: 'Assign' },
                }).save();

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

    //  /uniqueId/:uniqueId
    fastify.delete(
        '/uniqueId/:uniqueId',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { uniqueId } = request.params;
                await TaskModel.findOneAndDelete({ uniqueId });

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

    //  /uniqueIds/:ids
    fastify.delete(
        '/uniqueIds/:ids',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { ids } = request.params;
                await TaskModel.deleteMany({ uniqueId: { $in: ids } });

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

    //  /uniqueId/:uniqueId
    fastify.put(
        '/uniqueId/:uniqueId',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            const { status } = request.body;
            try {
                const { uniqueId } = request.params;
                await TaskModel.findOneAndUpdate(
                    { uniqueId },
                    {
                        status,
                        lastActivity: {
                            who: request.user.name,
                            what: status,
                        },
                    },
                );

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

    //  /uniqueId/:uniqueId/reply
    fastify.post(
        '/uniqueId/:uniqueId/reply',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { uniqueId } = request.params;
                const comment = await TaskModel.findOne({ uniqueId });
                comment.replies = [
                    ...comment.replies,
                    { ...request.body, name: request.user.name },
                ];
                comment.lastActivity = {
                    who: request.user.name,
                    what: 'Reply',
                };
                await comment.save();

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
