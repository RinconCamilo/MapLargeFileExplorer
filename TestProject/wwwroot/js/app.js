'use strict';

import { Formatter } from './Formatter.js';
import { Router } from './router.js';
import { Api } from './api.js';
import { UI } from './ui.js';

const App = {
    _cachedEntries: [],
    _cache: null,

    async init() {
        UI.init();

        UI.el.openBtn.addEventListener('click', () => {
            UI.openExplorer();
            this._loadFromState(Router.getState());
        });

        UI.el.closeBtn.addEventListener('click', () => UI.closeExplorer());

        UI.el.overlay.addEventListener('click', e => {
            if (e.target === UI.el.overlay) UI.closeExplorer();
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                if (!UI.el.confirmDialog.classList.contains('hidden') ||
                    !UI.el.inputDialog.classList.contains('hidden')) return;
                UI.closeExplorer();
            }
        });

        const applyTheme = isLight => {
            document.documentElement.dataset.theme = isLight ? 'light' : '';
            UI.el.themeToggleBtn.textContent = isLight ? '☀️' : '🌙';
            UI.el.themeToggleBtn.title = isLight
                ? 'Switch to dark theme' : 'Switch to light theme';

            localStorage.setItem('fe-theme', isLight ? 'light' : 'dark');
        };

        const stored = localStorage.getItem('fe-theme');
        const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

        applyTheme(stored ? stored === 'light' : prefersLight);

        UI.el.themeToggleBtn.addEventListener('click', () => {
            applyTheme(document.documentElement.dataset.theme !== 'light');
        });

        UI.el.searchBtn.addEventListener('click', () => this._triggerSearch());
        UI.el.searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') this._triggerSearch();
        });
        UI.el.clearSearchBtn.addEventListener('click', () => {
            UI.el.searchInput.value = '';
            Router.clearSearch();
        });

        document.querySelectorAll('#file-table th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const state = Router.getState();
                const field = th.dataset.sort;
                const dir = (state.sort === field && state.dir === 'asc') ? 'desc' : 'asc';
                Router.setState({ sort: field, dir });
            });
        });

        UI.el.newFolderBtn.addEventListener('click', () => this.handleNewFolder());

        UI.el.uploadBtn.addEventListener('click', () => UI.el.fileInput.click());
        UI.el.fileInput.addEventListener('change', async e => {
            if (e.target.files.length > 0) {
                await this._doUpload(e.target.files);
                e.target.value = '';
            }
        });

        const dropTarget = UI.el.dialog;

        dropTarget.addEventListener('dragover', e => {
            e.preventDefault();
            UI.el.dropOverlay.classList.remove('hidden');
        });

        dropTarget.addEventListener('dragleave', e => {
            if (!dropTarget.contains(e.relatedTarget))
                UI.el.dropOverlay.classList.add('hidden');
        });

        dropTarget.addEventListener('drop', async e => {
            e.preventDefault();
            UI.el.dropOverlay.classList.add('hidden');
            if (e.dataTransfer.files.length > 0)
                await this._doUpload(e.dataTransfer.files);
        });

        Router.onNavigate(state => this._loadFromState(state));

        const initialState = Router.getState();
        if (initialState.path || initialState.search) {
            UI.openExplorer();
            this._loadFromState(initialState);
        }
    },

    async _loadFromState(state) {
        if (state.search) {
            UI.el.searchInput.value = state.search;
            UI.el.clearSearchBtn.classList.remove('hidden');

            await this._doSearch(state.path, state.search, state.sort, state.dir);
        } else {
            UI.el.searchInput.value = '';
            UI.el.clearSearchBtn.classList.add('hidden');

            if (this._cache?.path === state.path) {
                UI.renderEntries(this._cachedEntries, state.sort, state.dir, this._handlers());
            } else {
                await this._doBrowse(state.path, state.sort, state.dir);
            }
        }
    },

    navigate(path) {
        Router.setState({ path, search: '' });
    },

    _handlers() {
        return {
            onNavigate: path => this.navigate(path),
            onAction: (action, entry) => {
                if (action === 'download') Api.download(entry.relativePath);
                if (action === 'rename') this.handleRename(entry);
                if (action === 'copy') this.handleCopy(entry);
                if (action === 'delete') this.handleDelete(entry);
            },
        };
    },

    async _doBrowse(path, sortField = 'name', sortDir = 'asc') {
        UI.showLoading();
        try {
            const result = await Api.browse(path);

            this._cachedEntries = result.entries;
            this._cache = { path };

            UI.renderBreadcrumb(result.requestedPath, p => this.navigate(p));
            UI.renderStats(result.entries);
            UI.renderEntries(result.entries, sortField, sortDir, this._handlers());
        } catch (err) {
            UI.showError(`Could not load directory: ${err.message}`);
        } finally {
            UI.hideLoading();
        }
    },

    _triggerSearch() {
        const query = UI.el.searchInput.value.trim();

        if (!query) {
            Router.clearSearch(); return;
        }

        Router.setState({ search: query });
    },

    async _doSearch(path, query, sortField = 'name', sortDir = 'asc') {
        UI.showLoading();

        try {
            const result = await Api.search(path, query);

            this._cachedEntries = result.results;
            this._cache = null;

            UI.renderBreadcrumb(result.searchRoot, p => this.navigate(p));
            const extraMsg = result.isTruncated
                ? '⚠ Results capped at 500 — refine your search for more specific results' : '';
            UI.renderStats(result.results, extraMsg);
            UI.renderEntries(result.results, sortField, sortDir, this._handlers());
        } catch (err) {
            UI.showError(`Search failed: ${err.message}`);
        } finally {
            UI.hideLoading();
        }
    },

    async _doUpload(fileList) {
        const { path, sort, dir } = Router.getState();
        UI.showLoading();

        try {
            await Api.upload(path, fileList);

            this._cache = null;

            await this._doBrowse(path, sort, dir);
        } catch (err) {
            UI.showError(`Upload failed: ${err.message}`);
            UI.hideLoading();
        }
    },

    async handleRename(entry) {
        const newName = await UI.prompt(`Rename "${entry.name}" to:`, entry.name);

        if (!newName || newName === entry.name) return;

        const parts = entry.relativePath.split('/');
        parts[parts.length - 1] = newName;

        try {
            await Api.move(entry.relativePath, parts.join('/'));

            this._cache = null;
            const { path, sort, dir } = Router.getState();

            await this._doBrowse(path, sort, dir);
        } catch (err) {
            UI.showError(`Rename failed: ${err.message}`);
        }
    },

    async handleCopy(entry) {
        const dest = await UI.prompt(
            `Copy "${entry.name}" to path (relative to home):`,
            entry.relativePath + '_copy'
        );

        if (!dest) return;

        try {
            await Api.copy(entry.relativePath, dest);

            this._cache = null;
            const { path, sort, dir } = Router.getState();

            await this._doBrowse(path, sort, dir);
        } catch (err) {
            UI.showError(`Copy failed: ${err.message}`);
        }
    },

    async handleDelete(entry) {
        const label = entry.isDirectory ? 'folder' : 'file';
        const extra = entry.isDirectory
            ? '\n\nAll files and subfolders inside will be permanently deleted.' : '';
        const confirmed = await UI.confirm(`Delete ${label} "${entry.name}"?${extra}`);

        if (!confirmed) return;

        try {
            await Api.delete(entry.relativePath);

            this._cache = null;
            const { path, sort, dir } = Router.getState();

            await this._doBrowse(path, sort, dir);
        } catch (err) {
            UI.showError(`Delete failed: ${err.message}`);
        }
    },

    async handleNewFolder() {
        const name = await UI.prompt('New folder name:');

        if (!name) return;

        const { path, sort, dir } = Router.getState();

        try {
            await Api.mkdir(path, name);

            this._cache = null;

            await this._doBrowse(path, sort, dir);
        } catch (err) {
            UI.showError(`Could not create folder: ${err.message}`);
        }
    },
};

document.addEventListener('DOMContentLoaded', () => App.init());