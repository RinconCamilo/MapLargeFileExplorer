'use strict';

import { Formatter } from './Formatter.js';

export const UI = {
    el: {},
    _errorTimer: null,

    /** Cache DOM references and attach static event listeners. */
    init() {
        const $ = id => document.getElementById(id);
        this.el = {
            overlay: $('modal-overlay'),
            openBtn: $('open-explorer-btn'),
            closeBtn: $('close-dialog-btn'),
            themeToggleBtn: $('theme-toggle-btn'),
            dialog: $('explorer-dialog'),
            breadcrumb: $('breadcrumb'),
            searchInput: $('search-input'),
            searchBtn: $('search-btn'),
            clearSearchBtn: $('clear-search-btn'),
            statsBar: $('stats-bar'),
            fileList: $('file-list'),
            fileTable: $('file-table'),
            loading: $('loading'),
            errorBanner: $('error-banner'),
            uploadBtn: $('upload-btn'),
            fileInput: $('file-input'),
            newFolderBtn: $('new-folder-btn'),
            dropOverlay: $('drop-overlay'),
            confirmDialog: $('confirm-dialog'),
            confirmMsg: $('confirm-message'),
            confirmOk: $('confirm-ok'),
            confirmCancel: $('confirm-cancel'),
            inputDialog: $('input-dialog'),
            inputLabel: $('input-label'),
            inputValue: $('input-value'),
            inputOk: $('input-ok'),
            inputCancel: $('input-cancel'),
        };
    },

    openExplorer() { this.el.overlay.classList.remove('hidden'); },
    closeExplorer() { this.el.overlay.classList.add('hidden'); },

    showLoading() {
        this.el.loading.classList.remove('hidden');
        this.el.fileList.style.opacity = '0.4';
    },
    hideLoading() {
        this.el.loading.classList.add('hidden');
        this.el.fileList.style.opacity = '1';
    },

    /** Show the error banner and auto-dismiss after 6 seconds. */
    showError(msg) {
        this.el.errorBanner.textContent = `⚠ ${msg}`;
        this.el.errorBanner.classList.remove('hidden');
        clearTimeout(this._errorTimer);
        this._errorTimer = setTimeout(() =>
            this.el.errorBanner.classList.add('hidden'), 6000);
    },

    renderBreadcrumb(path, onNavigate) {
        const segments = Formatter.pathSegments(path);
        const frag = document.createDocumentFragment();

        const home = document.createElement('span');
        home.className = 'crumb';
        home.textContent = '🏠 Home';
        home.title = 'Go to home directory';
        home.addEventListener('click', () => onNavigate(''));
        frag.appendChild(home);

        let accumulated = '';
        segments.forEach((seg, i) => {
            accumulated += (accumulated ? '/' : '') + seg;
            const isLast = i === segments.length - 1;

            const sep = document.createElement('span');
            sep.className = 'crumb-sep';
            sep.textContent = '›';
            frag.appendChild(sep);

            const crumb = document.createElement('span');
            crumb.className = 'crumb' + (isLast ? ' crumb-current' : '');
            crumb.textContent = seg;

            if (!isLast) {
                const capturePath = accumulated;
                crumb.addEventListener('click', () => onNavigate(capturePath));
            }

            frag.appendChild(crumb);
        });

        this.el.breadcrumb.innerHTML = '';
        this.el.breadcrumb.appendChild(frag);
    },

    renderStats(entries, extraMsg = '') {
        const files = entries.filter(e => !e.isDirectory);
        const folders = entries.filter(e => e.isDirectory);
        const size = files.reduce((acc, e) => acc + (e.size ?? 0), 0);

        const parts = [];
        if (folders.length) parts.push(`${folders.length} folder${folders.length !== 1 ? 's' : ''}`);
        if (files.length) parts.push(`${files.length} file${files.length !== 1 ? 's' : ''}`);
        if (size > 0) parts.push(Formatter.fileSize(size));

        this.el.statsBar.textContent = parts.length ? parts.join(' · ') : 'Empty directory';

        if (extraMsg) {
            const warn = document.createElement('span');
            warn.className = 'truncation-warning';
            warn.textContent = extraMsg;
            this.el.statsBar.appendChild(warn);
        }
    },

    sortEntries(entries, field, dir) {
        return [...entries].sort((a, b) => {
            if (field === 'name' && a.isDirectory !== b.isDirectory)
                return a.isDirectory ? -1 : 1;

            let va, vb;
            switch (field) {
                case 'size': va = a.size ?? 0; vb = b.size ?? 0; break;
                case 'modified': va = a.lastModified ?? ''; vb = b.lastModified ?? ''; break;
                default: va = (a.name ?? '').toLowerCase(); vb = (b.name ?? '').toLowerCase();
            }

            if (va < vb) return dir === 'asc' ? -1 : 1;
            if (va > vb) return dir === 'asc' ? 1 : -1;
            return 0;
        });
    },

    renderEntries(entries, sortField = 'name', sortDir = 'asc', { onNavigate, onAction } = {}) {
        const sorted = this.sortEntries(entries, sortField, sortDir);
        const frag = document.createDocumentFragment();

        if (sorted.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 4;
            cell.className = 'empty-msg';
            cell.textContent = 'This folder is empty.';
            row.appendChild(cell);
            frag.appendChild(row);
        } else {
            for (const entry of sorted) {
                frag.appendChild(this._buildRow(entry, { onNavigate, onAction }));
            }
        }

        this.el.fileList.innerHTML = '';
        this.el.fileList.appendChild(frag);
        this._updateSortIcons(sortField, sortDir);
    },

    _buildRow(entry, { onNavigate, onAction } = {}) {
        const tr = document.createElement('tr');

        // ── Name cell ─────────────────────────────────────────────────────────
        const nameTd = document.createElement('td');
        nameTd.className = 'cell-name';

        const icon = document.createElement('span');
        icon.className = 'entry-icon';
        icon.textContent = entry.isDirectory ? '📁' : Formatter.fileIcon(entry.extension);

        const name = document.createElement('span');
        name.className = 'entry-name';
        name.textContent = entry.name;
        name.title = entry.name;

        if (entry.isDirectory) {
            name.classList.add('dir-link');
            name.addEventListener('click', () => onNavigate?.(entry.relativePath));
        }

        if (entry.isDirectory && entry.childCount != null) {
            const badge = document.createElement('span');
            badge.className = 'child-badge';
            badge.textContent = `(${entry.childCount})`;
            name.appendChild(badge);
        }

        nameTd.appendChild(icon);
        nameTd.appendChild(name);

        // ── Size cell ─────────────────────────────────────────────────────────
        const sizeTd = document.createElement('td');
        sizeTd.className = 'cell-size';
        sizeTd.textContent = entry.isDirectory ? '—' : Formatter.fileSize(entry.size);

        // ── Modified cell ─────────────────────────────────────────────────────
        const modTd = document.createElement('td');
        modTd.className = 'cell-modified';
        modTd.textContent = Formatter.date(entry.lastModified);
        modTd.title = entry.lastModified
            ? new Date(entry.lastModified).toLocaleString() : '';

        // ── Actions cell ──────────────────────────────────────────────────────
        const actTd = document.createElement('td');
        actTd.className = 'cell-actions';
        actTd.appendChild(this._buildRowActions(entry, onAction));

        tr.appendChild(nameTd);
        tr.appendChild(sizeTd);
        tr.appendChild(modTd);
        tr.appendChild(actTd);
        return tr;
    },

    _buildRowActions(entry, onAction) {
        const wrap = document.createElement('div');
        wrap.className = 'row-actions';

        if (!entry.isDirectory)
            wrap.appendChild(this._actBtn('⬇', 'Download', () => onAction?.('download', entry)));

        wrap.appendChild(this._actBtn('✏', 'Rename', () => onAction?.('rename', entry)));
        wrap.appendChild(this._actBtn('⧉', 'Copy', () => onAction?.('copy', entry)));
        wrap.appendChild(this._actBtn('🗑', 'Delete', () => onAction?.('delete', entry), 'danger'));
        return wrap;
    },

    _actBtn(icon, title, onClick, extraClass = '') {
        const btn = document.createElement('button');
        btn.className = `act-btn ${extraClass}`.trim();
        btn.title = title;
        btn.textContent = icon;
        btn.addEventListener('click', e => { e.stopPropagation(); onClick(); });
        return btn;
    },

    _updateSortIcons(activeField, activeDir) {
        document.querySelectorAll('#file-table th[data-sort]').forEach(th => {
            const icon = th.querySelector('.sort-icon');
            if (!icon) return;
            const isActive = th.dataset.sort === activeField;
            icon.textContent = isActive ? (activeDir === 'asc' ? ' ▲' : ' ▼') : '';
            th.classList.toggle('sort-active', isActive);
        });
    },

    confirm(message) {
        return new Promise(resolve => {
            this.el.confirmMsg.textContent = message;
            this.el.confirmDialog.classList.remove('hidden');

            const finish = result => {
                this.el.confirmDialog.classList.add('hidden');
                this.el.confirmOk.removeEventListener('click', onOk);
                this.el.confirmCancel.removeEventListener('click', onCancel);
                resolve(result);
            };

            const onOk = () => finish(true);
            const onCancel = () => finish(false);
            this.el.confirmOk.addEventListener('click', onOk);
            this.el.confirmCancel.addEventListener('click', onCancel);
        });
    },

    prompt(labelText, defaultValue = '') {
        return new Promise(resolve => {
            this.el.inputLabel.textContent = labelText;
            this.el.inputValue.value = defaultValue;
            this.el.inputDialog.classList.remove('hidden');

            requestAnimationFrame(() => {
                this.el.inputValue.focus();
                this.el.inputValue.select();
            });

            const finish = result => {
                this.el.inputDialog.classList.add('hidden');
                this.el.inputOk.removeEventListener('click', onOk);
                this.el.inputCancel.removeEventListener('click', onCancel);
                this.el.inputValue.removeEventListener('keydown', onKey);
                resolve(result);
            };

            const onOk = () => finish(this.el.inputValue.value.trim() || null);
            const onCancel = () => finish(null);
            const onKey = e => {
                if (e.key === 'Enter') { e.preventDefault(); onOk(); }
                if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
            };

            this.el.inputOk.addEventListener('click', onOk);
            this.el.inputCancel.addEventListener('click', onCancel);
            this.el.inputValue.addEventListener('keydown', onKey);
        });
    },
};