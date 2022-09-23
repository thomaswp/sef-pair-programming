import { Cloud, Snap } from "sef";
import { newGuid, ThreadManager } from "sef/src/snap/Snap";


type PointerNotes = {
    sessionID: string,
}

const POINTER_PROJECT_NAME = "~PairProgrammingPointer";
const PP_PROJECT_PREFIX = "~PairShare-";

export class IO {

    static readonly

    sessionID: string;
    partnerName: string;

    getPointerNotes(): PointerNotes {
        return {
            sessionID: this.sessionID,
        };
    }

    createPointerProject() : Cloud.ProjectSaveBody {
        // TODO: nulls may not be allowed
        return {
            notes: JSON.stringify(this.getPointerNotes()),
            remixID: null,
            thumbnail: null,
            xml: null,
            media: null,
        };
    }

    getProjectSaveName() : string {
        return PP_PROJECT_PREFIX + this.sessionID;
    }

    async startSession(partnerName: string) : Promise<string> {
        if (!Cloud.Utils.isLoggedIn()) return null;
        let data = Cloud.Utils.getCurrentProjectData(true);
        if (!data) return null;
        this.sessionID = newGuid();
        this.partnerName = partnerName;
        // TODO: Check for an existing pointer project
        let projectName = this.getProjectSaveName();
        try {
            await Cloud.Utils.saveProject(projectName, data);
            await Cloud.Utils.shareProject(projectName);
            await Cloud.Utils.saveProject(POINTER_PROJECT_NAME,
                this.createPointerProject());
            // TODO: Sleep for a bit to let the project save first for some reason..?
            await Cloud.Utils.shareProject(POINTER_PROJECT_NAME);
        } catch (e) {
            console.error('Failed to create pair programming session', e);
            this.endSession();
            return null;
        }
        return this.sessionID;
    }

    clearSessionInfo(): void {
        this.sessionID = null;
        this.partnerName = null;

    }

    endSession() : void {
        // TODO: remove projects
        this.clearSessionInfo();
    }
}