import { Cloud, Snap } from "sef";
import { newGuid, ThreadManager, XML_Serializer } from "sef/src/snap/Snap";


type PointerData = {
    sessionID: string,
    partnerName: string,
}

const POINTER_PROJECT_NAME = "~PairProgrammingPointer";
const PP_PROJECT_PREFIX = "~PairShare-";

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

    async startSession(partnerName: string) : Promise<string> {
        if (!Cloud.Utils.isLoggedIn()) return null;
        this.sessionID = newGuid();
        this.partnerName = partnerName;
        try {
            await Cloud.Utils.saveProject(POINTER_PROJECT_NAME,
                this.createPointerProject());
            await Cloud.Utils.shareProject(POINTER_PROJECT_NAME);
        } catch (e) {
            console.error('Failed to create pair programming session', e);
            this.endSession();
            return null;
        }
        return this.sessionID;
    }

    async verifySession() : Promise<boolean> {
        try {
            let xml = await Cloud.Utils.getPublicProject(
                POINTER_PROJECT_NAME, this.partnerName);
            let serializer = Snap.IDE.serializer as XML_Serializer;
            console.log(xml);
            let model = serializer.parse(xml);
            console.log(model);
            let notes = model?.children[0]?.attributes?.notes;
            console.log(notes);
            if (!notes) return false;
            notes = notes.replace(/'/g, '"');
            let pointerData = JSON.parse(notes);
            console.log(pointerData);
            return true;
            // TODO parse XML and extract notes
        } catch (e) {
            console.error('Failed to verify session', e);
            return false;
        }
        return true;
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

    async save(share = false) : Promise<boolean> {
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