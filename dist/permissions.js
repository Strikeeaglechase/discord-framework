class PermissionManager {
    framework;
    permissions;
    tracks = new Map();
    paths = new Set();
    constructor(framework) {
        this.framework = framework;
    }
    get permNames() {
        return [...this.paths];
    }
    async init() {
        this.permissions = await this.framework.database.collection("permissions-new", false, "name");
        this.framework.log.info(`Permission manager started`);
    }
    async loadPerms(permissionNames) {
        permissionNames.forEach(name => {
            this.paths.add(name);
        });
    }
    async setPublic(name, pub) {
        const perm = await this.getPermission(name);
        perm.public = pub;
        await this.permissions.update(perm, perm.name);
    }
    async grant(name, id) {
        const perm = await this.getPermission(name);
        if (perm.allow.includes(id))
            return false;
        perm.allow.push(id);
        await this.permissions.update(perm, perm.name);
        return true;
    }
    async remove(name, id) {
        const perm = await this.getPermission(name);
        if (!perm.allow.includes(id))
            return false;
        perm.allow = perm.allow.filter(pid => pid != id);
        await this.permissions.update(perm, perm.name);
        return true;
    }
    async getPermission(name) {
        const perm = await this.permissions.get(name);
        if (perm)
            return perm;
        return { name: name, allow: [], public: false };
    }
    async getUserRoles(userId) {
        if (!this.tracks.get(userId)) {
            this.tracks.set(userId, new Map());
        }
        const guilds = this.framework.client.guilds.cache;
        const roles = [];
        const proms = guilds.map(async (guild) => {
            if (this.tracks.get(userId).get(guild.id))
                return; // If the guild flag is set, this user isnt in the server
            const member = await guild.members.fetch(userId).catch(() => { });
            if (member)
                member.roles.cache.forEach(r => roles.push(r.id));
            else
                this.tracks.get(userId).set(guild.id, true); // Set guild flag
        });
        await Promise.all(proms);
        roles.push(userId);
        return roles;
    }
    clearUserTracks(userId) {
        this.tracks.set(userId, new Map());
    }
    async check(userId, chain) {
        if (this.framework.overrides.some(id => id == userId))
            return true;
        let curChain = "";
        const itemProms = chain.split(".").map(part => {
            curChain += curChain ? "." + part : part;
            return this.getPermission(curChain);
        });
        const items = await Promise.all(itemProms);
        if (items.some(item => item.public))
            return true; // If there is a public part of the chain, return true
        const userRoles = await this.getUserRoles(userId);
        for (let item of items) {
            if (userRoles.some(roleId => item.allow.includes(roleId)))
                return true;
        }
        return false;
    }
}
export { PermissionManager };
