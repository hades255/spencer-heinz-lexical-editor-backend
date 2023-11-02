export const HTTP_RES_CODE = {
    SUCCESS: 'success',
    ERROR: 'error',
};

// document status
export const DOCUMENT_STATUS = {
    CREATED: 'created',
    EDITING: 'editing',
    COMPLETED: 'completed',
    BLOCKED: 'blocked',
};

export const MessageType = {
    Sync: 0,
    Awareness: 1,
};

export const NOTIFICATION_STATUS = {
    NEW: 'new',
    READ: 'read',
    UNREAD: 'unread',
};

export const USER_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    LOCKED: 'locked',
    DELETED: 'deleted',
    INVITED: 'invited',
};

export const USER_ROLES = {
    ADMIN: 'admin',
    SUPERADMIN: 'super admin',
    CREATOR: 'creator',
    CONTRIBUTOR: 'contributor',
};

export const NOTIFICATION_TYPES = {
    DOCUMENT_INVITE_SEND: '@document/invite/send',
    DOCUMENT_INVITE_RECEIVE: '@document/invite/receive',
    DOCUMENT_INVITE_ACCEPT: '@document/invite/accept',
    DOCUMENT_INVITE_REJECT: '@document/invite/reject',
    DOCUMENT_INVITE_APPROVE: '@document/invite/approve',
    DOCUMENT_INVITE_DELETE: '@document/invite/delete',
    USER_SETTING_ROLE: '@user/setting/role',
    USER_SETTING_STATUS: '@user/setting/status',
    USER_RESET_PASSWORD: '@user/reset/password',
};

export const MESSAGE_TYPES = {
    DOCUMENT_INVITE_RESOLVE: '@document/invite/resolve/nonactive-users',
};
