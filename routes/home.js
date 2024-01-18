import mongoose from 'mongoose';
import { fastifyPassport } from '../app.js';
import TaskModel from '../models/Task.js';
import { HTTP_RES_CODE } from '../shared/constants.js';
import DocumentModel from '../models/Document.js';

const homeRouter = (fastify, opts, done) => {
    fastify.get(
        '/documents/:category',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { category } = request.params;
                let data = null;
                let docIds, docs;
                switch (category) {
                    case 'tasks':
                        docIds = await TaskModel.aggregate([
                            {
                                $match: {
                                    assignee: new mongoose.Types.ObjectId(
                                        request.user._id,
                                    ),
                                },
                            },
                            {
                                $match: {
                                    status: { $not: { $eq: 'complete' } },
                                },
                            },
                            { $group: { _id: '$doc' } },
                        ]);
                        docs = await DocumentModel.find({
                            _id: { $in: docIds },
                        });
                        data = [{ docs }];
                        break;
                    case 'asks':
                        docIds = await TaskModel.aggregate([
                            {
                                $match: {
                                    commentor: new mongoose.Types.ObjectId(
                                        request.user._id,
                                    ),
                                },
                            },
                            {
                                $match: {
                                    status: { $not: { $eq: 'complete' } },
                                },
                            },
                            { $group: { _id: '$doc' } },
                        ]);
                        docs = await DocumentModel.find({
                            _id: { $in: docIds },
                        });
                        data = [{ docs }];
                        break;
                    case 'myDocs':
                        docs = await DocumentModel.find({});
                        data = [
                            {
                                title: 'Documents where you had made requests of others',
                                docs: docs.filter((item) =>
                                    item.invites.find(
                                        (contributor) =>
                                            contributor._id.toString() ===
                                            request.user._id.toString(),
                                    ),
                                ),
                            },
                            {
                                title: 'Documents where others have made requests of you',
                                docs: docs.filter((item) =>
                                    item.invites.find(
                                        (contributor) =>
                                            contributor.invitor.toString() ===
                                            request.user._id.toString(),
                                    ),
                                ),
                            },
                            {
                                title: 'Documents you created',
                                docs: docs.filter(
                                    (item) =>
                                        item.creator.toString() ===
                                        request.user._id.toString(),
                                ),
                            },
                        ];
                        break;
                    case 'editDocs':
                        docs = await DocumentModel.find({});
                        data = [
                            {
                                title: '',
                                docs: docs.filter(
                                    (item) =>
                                        item.creator.toString() ===
                                        request.user._id.toString(),
                                ),
                            },
                        ];
                        break;
                    case 'reviews':
                        docIds = await TaskModel.aggregate([
                            {
                                $match: {
                                    commentor: new mongoose.Types.ObjectId(
                                        request.user._id,
                                    ),
                                },
                            },
                            { $match: { status: 'review' } },
                            { $group: { _id: '$doc' } },
                        ]);
                        docs = await DocumentModel.find({
                            _id: { $in: docIds },
                        });
                        data = [{ docs }];
                        break;
                    default:
                        break;
                }
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data,
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
    fastify.get(
        '/documents/category',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const tasks = await TaskModel.countDocuments({
                    assignee: new mongoose.Types.ObjectId(request.user._id),
                    status: { $not: { $eq: 'complete' } },
                });
                const reviews = await TaskModel.countDocuments({
                    commentor: new mongoose.Types.ObjectId(request.user._id),
                    status: 'review',
                });
                const asks = await TaskModel.countDocuments({
                    commentor: new mongoose.Types.ObjectId(request.user._id),
                    status: { $not: { $eq: 'complete' } },
                });
                const docs = await DocumentModel.find({});
                const myDocs = docs.filter(
                    (item) =>
                        item.creator._id.toString() ===
                            request.user._id.toString() ||
                        item.invites.find(
                            (contributor) =>
                                contributor._id.toString() ===
                                request.user._id.toString(),
                        ),
                );
                const editDocs = docs.filter(
                    (item) =>
                        item.creator._id.toString() ===
                        request.user._id.toString(),
                );
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        tasks: tasks,
                        asks: asks,
                        reviews: reviews,
                        myDocs: myDocs.length,
                        editDocs: editDocs.length,
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
        },
    );
    fastify.get(
        '/documents/:docId/tasks/:type',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { docId, type } = request.params;
                const tasks = await TaskModel.find({
                    doc: docId,
                    $or:
                        type === 'asks'
                            ? [{ commentor: request.user._id }]
                            : type === 'tasks'
                            ? [{ assignee: request.user._id }]
                            : [
                                  { assignee: request.user._id },
                                  { commentor: request.user._id },
                              ],
                })
                    .populate({ path: 'commentor', select: 'name' })
                    .populate({ path: 'assignee', select: 'name' });
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: tasks,
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

export default homeRouter;
