class GlobalYjsData {
    static RootElements = {};
    static RootUndoManagers = {};
    static ValidationFlags = {};

    constructor() {}

    static addRootElement(docName, RootElement) {
        GlobalYjsData.RootElements[docName] = RootElement;
        return RootElement;
    }

    static getRootElement(docName) {
        return GlobalYjsData.RootElements[docName];
    }

    static addRootUndoManager(docName, undoManager) {
        GlobalYjsData.RootUndoManagers[docName] = undoManager;
        GlobalYjsData.ValidationFlags[docName] = true;
        return undoManager;
    }

    static getRootUndoManager(docName) {
        return GlobalYjsData.RootUndoManagers[docName];
    }

    static setValidationFlag(docName, flag) {
        GlobalYjsData.ValidationFlags[docName] = flag;
        return flag;
    }

    static getValidationFlag(docName) {
        return GlobalYjsData.ValidationFlags[docName];
    }
}

export default GlobalYjsData;
