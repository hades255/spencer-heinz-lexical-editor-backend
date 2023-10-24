import DocumentModel from '../models/Document.js';
import UserModel from '../models/User.js';
import InviteModel from '../models/invite.js';
import { HTTP_RES_CODE } from '../shared/constants.js';
import { createAuthToken, sendEmail } from '../shared/helpers.js';

const inviteRouter = (fastify, opts, done) => {
    fastify.get('/:token', async (request, reply) => {
        try {
            const invite = await InviteModel.findOneAndUpdate(
                {
                    token: request.params.token,
                },
                { status: 'done' },
            );
            if (invite) {
                const user = await UserModel.findByIdAndUpdate(
                    invite.contributor._id,
                    { status: 'active' },
                );
                const document = await DocumentModel.findById(
                    invite.document._id,
                );
                if (
                    !document.contributors.find(
                        (item) => item._id === invite.contributor._id,
                    )
                )
                    document.contributors = [...document.contributors, user];
                document.invites = document.invites.map((item) => ({
                    ...item,
                    status:
                        item._id.toString() ===
                        invite.contributor._id.toString()
                            ? 'accept'
                            : item.status,
                    date:
                        item._id.toString() ===
                        invite.contributor._id.toString()
                            ? new Date()
                            : item.date,
                }));
                await document.save();
                const serviceToken = createAuthToken(user);
                return reply.send({
                    code: HTTP_RES_CODE.SUCCESS,
                    data: {
                        serviceToken,
                        user,
                        document: invite.document._id,
                    },
                    message: '',
                });
            }
            return reply.code(404).send({
                code: HTTP_RES_CODE.ERROR,
                message: 'no invitation found',
            });
        } catch (error) {
            console.log('invite@get-error:', error);
            return reply.code(500).send({
                code: HTTP_RES_CODE.ERROR,
                data: {},
                message: 'Unexpected Server Error Occured.',
            });
        }
    });
    fastify.get('/mail', async (request, reply) => {
        try {
            sendEmail(null, {
                from: process.env.SERVER_MAIL_ADDRESS,
                to: 'montgasam@gmail.com',
                subject: `invited you to his document.`,
                text: `OK`,
            });
            return reply.code(404).send({
                code: HTTP_RES_CODE.ERROR,
                message: 'no invitation found',
            });
        } catch (error) {
            console.log('invite@get-error:', error);
            return reply.code(500).send({
                code: HTTP_RES_CODE.ERROR,
                data: {},
                message: 'Unexpected Server Error Occured.',
            });
        }
    });
    done();
};

export default inviteRouter;
