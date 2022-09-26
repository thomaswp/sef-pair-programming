import { Cloud, Snap } from "sef";
import { newGuid, ThreadManager, XML_Serializer } from "sef/src/snap/Snap";


type PointerData = {
    sessionID: string,
    partnerName: string,
}

const POINTER_PROJECT_NAME = "~PairProgrammingPointer";
const PP_PROJECT_PREFIX = "~PairShare-";

/**
 * Workflow:
 * Start pair programming session
 * Enter partner's username
 * Check if partner has matching session:
 *   If yes: connect, set sessionID
 *     If sessionID != my sessionID and I have a sessionID, replace and repost my session
 *     Post message to tell partner to "retry"
 *   If no: post session, say "waiting for partner" with "retry" option
 *     Every 5 seconds, or if retry, check again
 * Once connected, say "Connected! and give instructions"
 *
*/

export enum SessionResult {
    WaitingForPartnerToConnect,
    ConnectedToPartner,
    PartnerSessionNotStarted,
    PartnerHasOtherPartner,
    PartnerSessionInvalid,
    NetworkError,
}

export class IO {

    sessionID: string;
    partnerName: string;

    getPointerData(): PointerData {
        return {
            sessionID: this.sessionID,
            partnerName: this.partnerName,
        };
    }

    createPointerProject() : Cloud.ProjectSaveBody {
        // TODO: nulls may not be allowed

        let pointerData = JSON.stringify(this.getPointerData());
        pointerData = pointerData.replace(/"/g, "'");

        // When a project is shared, only the remixID and xml are shared
        // so we have to embed data in the XML itself.
        const projectXML =
        '<project name="&#126;PairProgrammingPointer" '+
        'app="Snap! 7, https://snap.berkeley.edu" version="2" ' +
        `notes="${pointerData}"` +
        '></project>';

        const mediaXML =
        "<media name=\"untitled\" app=\"Snap! 7, " +
        "https://snap.berkeley.edu\" version=\"2\"></media>";

        return {
            notes: '',
            remixID: null,
            thumbnail: Snap.IDE.getProject().thumbnail.toDataURL(),
            xml: projectXML,
            media: mediaXML,
        };
    }

    getProjectSaveName() : string {
        return PP_PROJECT_PREFIX + this.sessionID;
    }

    get isInSession() : boolean {
        return this.sessionID != null && Cloud.Utils.isLoggedIn();
    }

    async startSession(partnerName: string) : Promise<SessionResult> {
        if (!Cloud.Utils.isLoggedIn()) return null;
        this.partnerName = partnerName;
        try {
            let result = await this.tryJoinOrVerifyPartner();
            if (result == SessionResult.ConnectedToPartner) return result;
            await this.startNewSession();
            return SessionResult.WaitingForPartnerToConnect;
        } catch (e) {
            console.error('Failed to create pair programming session', e);
            this.endSession();
            return SessionResult.NetworkError;
        }
    }

    private async startNewSession() {
        this.sessionID = newGuid();
        this.updatePointerProject();
    }

    private async updatePointerProject() : Promise<void> {
        await Cloud.Utils.saveProject(POINTER_PROJECT_NAME,
            this.createPointerProject());
        await Cloud.Utils.shareProject(POINTER_PROJECT_NAME);
    }

    async tryJoinOrVerifyPartner() : Promise<SessionResult> {
        try {
            let partnerData = await this.getPartnerPointerData();
            if (!partnerData) return SessionResult.PartnerSessionNotStarted;
            if (partnerData.partnerName != Snap.cloud.username) {
                return SessionResult.PartnerHasOtherPartner;
            }
            if (!partnerData.sessionID) {
                return SessionResult.PartnerSessionInvalid;
            }
            if (this.sessionID != partnerData.sessionID) {
                this.sessionID = partnerData.sessionID;
                await this.updatePointerProject();
            }
            return SessionResult.ConnectedToPartner;
        } catch (e) {
            return SessionResult.PartnerSessionNotStarted;
        }
    }

    async getPartnerPointerData() : Promise<PointerData> {
        let xml = await Cloud.Utils.getPublicProject(
            POINTER_PROJECT_NAME, this.partnerName);
        let serializer = Snap.IDE.serializer as XML_Serializer;
        let model = serializer.parse(xml);
        let notes = model?.children[0]?.attributes?.notes;
        if (!notes) return null;
        notes = notes.replace(/'/g, '"');
        try {
            return JSON.parse(notes) as PointerData;
        } catch (e) {
            console.warn('Improper notes data', notes);
            return null;
        }
    }

    static isTempProject(name: string): boolean {
        if (!name) return false;
        return name === POINTER_PROJECT_NAME ||
            name.startsWith(PP_PROJECT_PREFIX);
    }

    async cleanSessions() {
        let projects = await Cloud.Utils.getCloudProjects(false);
        let toDelete = projects.map(p => p.projectname).filter(IO.isTempProject);
        for (let name of toDelete) {
            await Cloud.Utils.deleteProject(name);
        }
    }

    async save(share = true) : Promise<boolean> {
        if (!this.isInSession) return false;
        let projectName = this.getProjectSaveName();
        let data = Cloud.Utils.getCurrentProjectData(true);
        if (!data) return false;
        await Cloud.Utils.saveProject(projectName, data);
        if (share) await Cloud.Utils.shareProject(projectName);
        return true;
    }

    async loadFromPartner() : Promise<boolean> {
        // TODO
        return false;
    }

    clearSessionInfo(): void {
        this.sessionID = null;
        this.partnerName = null;

    }

    endSession() : void {
        // TODO: remove projects
        this.clearSessionInfo();
        this.cleanSessions();
    }
}