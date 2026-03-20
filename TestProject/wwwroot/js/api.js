'use strict';

export const Api = {
    BASE: '/api/fs',

    _url(endpoint, params = {}) {
        const qs = new URLSearchParams(
            Object.fromEntries(
                Object.entries(params).filter(([, v]) => v != null && v !== '')
            )
        );

        const q = qs.toString();

        return `${this.BASE}/${endpoint}${q ? '?' + q : ''}`;
    },

    async _assertOk(response) {
        if (response.ok) {
            return response;
        }

        let msg = `HTTP ${response.status} ${response.statusText}`;

        try {
            const body = await response.json();

            if (body.error) {
                msg = body.detail ? `${body.error}: ${body.detail}` : body.error;
            }
        } catch {
            /* non-JSON error body — keep the status text */
        }

        throw new Error(msg);
    },

    async browse(path) {
        const res = await fetch(this._url('browse', { path }));

        await this._assertOk(res);

        return res.json();
    },

    async search(path, query) {
        const res = await fetch(this._url('search', { path, query }));

        await this._assertOk(res);

        return res.json();
    },

    download(path) {
        const a = document.createElement('a');

        a.href = this._url('download', { path });
        a.download = path.split('/').pop() ?? 'download';
        document.body.appendChild(a);

        a.click();

        document.body.removeChild(a);
    },

    async upload(directoryPath, fileList) {
        const form = new FormData();

        for (const file of fileList) {
            form.append('files', file);
        }

        const res = await fetch(this._url('upload', { path: directoryPath }), {
            method: 'POST',
            body: form,
        });

        await this._assertOk(res);

        return res.json();
    },

    async delete(path) {
        const res = await fetch(this._url('item', { path }), { method: 'DELETE' });

        await this._assertOk(res);

        return res.json();
    },

    async move(sourcePath, destinationPath) {
        const res = await fetch(`${this.BASE}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourcePath, destinationPath }),
        });

        await this._assertOk(res);

        return res.json();
    },

    async copy(sourcePath, destinationPath) {
        const res = await fetch(`${this.BASE}/copy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourcePath, destinationPath }),
        });

        await this._assertOk(res);

        return res.json();
    },

    async mkdir(path, name) {
        const res = await fetch(`${this.BASE}/mkdir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, name }),
        });

        await this._assertOk(res);

        return res.json();
    },
};