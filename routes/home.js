import mongoose from 'mongoose';
import { fastifyPassport } from '../app.js';
import TaskModel from '../models/Task.js';
import { HTTP_RES_CODE } from '../shared/constants.js';
import DocumentModel from '../models/Document.js';

const homeRouter = (fastify, opts, done) => {
    fastify.get(
        '/documents/category/:group/:category',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { group, category } = request.params;
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
                                    task: { $not: { $eq: 'Comment' } },
                                },
                            },
                            { $group: { _id: '$doc' } },
                        ]);
                        docs = await DocumentModel.find({
                            _id: { $in: docIds },
                        });
                        // tasks = await TaskModel.find({
                        //     doc: { $in: docIds },
                        // });
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
                                    task: { $not: { $eq: 'Comment' } },
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
                    case 'edit':
                        docIds = await TaskModel.aggregate([
                            {
                                $match: {
                                    [group === 'tasks'
                                        ? 'assignee'
                                        : 'commentor']:
                                        new mongoose.Types.ObjectId(
                                            request.user._id,
                                        ),
                                },
                            },
                            {
                                $match: {
                                    $or: [
                                        { status: 'assign' },
                                        { status: 'rework' },
                                    ],
                                },
                            },
                            {
                                $match: { task: { $not: { $eq: 'Comment' } } },
                            },
                            { $group: { _id: '$doc' } },
                        ]);
                        docs = await DocumentModel.find({
                            _id: { $in: docIds },
                        });
                        data = [{ docs }];
                        break;
                    case 'reviews':
                        docIds = await TaskModel.aggregate([
                            {
                                $match: {
                                    [group === 'tasks'
                                        ? 'assignee'
                                        : 'commentor']:
                                        new mongoose.Types.ObjectId(
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
                    case 'comments':
                        docIds = await TaskModel.aggregate([
                            {
                                $match: {
                                    [group === 'tasks'
                                        ? 'assignee'
                                        : 'commentor']:
                                        new mongoose.Types.ObjectId(
                                            request.user._id,
                                        ),
                                },
                            },
                            {
                                $match: {
                                    task: 'Comment',
                                },
                            },
                            { $group: { _id: '$doc' } },
                        ]);
                        docs = await DocumentModel.find({
                            _id: { $in: docIds },
                        });
                        data = [{ docs }];
                        break;
                    case 'approvals':
                        docIds = await TaskModel.aggregate([
                            {
                                $match: {
                                    [group === 'tasks'
                                        ? 'assignee'
                                        : 'commentor']:
                                        new mongoose.Types.ObjectId(
                                            request.user._id,
                                        ),
                                },
                            },
                            {
                                $match: {
                                    status: 'completed',
                                },
                            },
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
    // /documents/group/:group
    fastify.get(
        '/documents/group/:group',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { group } = request.params;
                const tasks = await TaskModel.countDocuments({
                    assignee: new mongoose.Types.ObjectId(request.user._id),
                    task: { $not: { $eq: 'Comment' } },
                    // status: { $not: { $eq: 'completed' } },
                });
                const asks = await TaskModel.countDocuments({
                    commentor: new mongoose.Types.ObjectId(request.user._id),
                    task: { $not: { $eq: 'Comment' } },
                    // status: { $not: { $eq: 'completed' } },
                });
                const edit = await TaskModel.countDocuments({
                    [group === 'tasks' ? 'assignee' : 'commentor']:
                        new mongoose.Types.ObjectId(request.user._id),
                    $or: [{ status: 'assign' }, { status: 'rework' }],
                    task: { $not: { $eq: 'Comment' } },
                });
                const reviews = await TaskModel.countDocuments({
                    [group === 'tasks' ? 'assignee' : 'commentor']:
                        new mongoose.Types.ObjectId(request.user._id),
                    status: 'review',
                });
                const comments = await TaskModel.countDocuments({
                    [group === 'tasks' ? 'assignee' : 'commentor']:
                        new mongoose.Types.ObjectId(request.user._id),
                    task: 'Comment',
                });
                const approvals = await TaskModel.countDocuments({
                    [group === 'tasks' ? 'assignee' : 'commentor']:
                        new mongoose.Types.ObjectId(request.user._id),
                    status: 'completed',
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
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        tasks,
                        asks,
                        edit,
                        reviews,
                        comments,
                        approvals,
                        myDocs: myDocs.length,
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
        '/documents/select/:group/:category/:docId',
        {
            preValidation: fastifyPassport.authenticate('protected', {
                session: false,
            }),
        },
        async (request, reply) => {
            try {
                const { docId } = request.params;
                const tasks = await TaskModel.find({
                    doc: docId,
                    ...getConditionFromCategory(request),
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
// status: { $not: { $eq: 'completed' } }
const getConditionFromCategory = (request) => {
    const { group, category } = request.params;
    switch (category) {
        case 'asks':
            return {
                commentor: request.user._id,
                // status: { $not: { $eq: 'completed' } },
            };
        case 'tasks':
            return {
                assignee: request.user._id,
                // status: { $not: { $eq: 'completed' } },
            };
        case 'myDocs':
            return {
                $or: [
                    { commentor: request.user._id },
                    { assignee: request.user._id },
                ],
            };
        case 'edit':
            return {
                [group === 'tasks' ? 'assignee' : 'commentor']:
                    new mongoose.Types.ObjectId(request.user._id),
                $or: [{ status: 'assign' }, { status: 'rework' }],
            };
        case 'comments':
            return {
                [group === 'tasks' ? 'assignee' : 'commentor']:
                    new mongoose.Types.ObjectId(request.user._id),
                task: 'Comment',
            };
        case 'review':
            return {
                [group === 'tasks' ? 'assignee' : 'commentor']:
                    new mongoose.Types.ObjectId(request.user._id),
                status: 'review',
            };
        case 'approvals':
            return {
                [group === 'tasks' ? 'assignee' : 'commentor']:
                    new mongoose.Types.ObjectId(request.user._id),
                status: 'completed',
            };
        default:
            return {};
    }
};
