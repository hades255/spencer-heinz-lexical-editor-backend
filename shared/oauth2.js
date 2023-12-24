import OAuth2 from '@fastify/oauth2';

const googleOAuth2Options = {
    name: 'GoogleOAuth2',
    scope: ['profile', 'email'],
    credentials: {
        client: {
            id: process.env.OAUTH2_GOOGLE_ID,
            secret: process.env.OAUTH2_GOOGLE_SECRET,
        },
        auth: OAuth2.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/oauth2/google',
    callbackUri: `${
        process.env.REACT_APP_API_URL || 'http://hades.pc.com:8000/'
    }oauth2/google/callback`,
    generateStateFunction: (request, reply) => {
        return request.query.state;
    },
    checkStateFunction: (request, callback) => {
        if (request.query.state) {
            callback();
            return;
        }
        callback(new Error('Invalid state'));
    },
};

export function registerGoogleOAuth2Provider(app) {
    app.register(OAuth2, googleOAuth2Options);
}
