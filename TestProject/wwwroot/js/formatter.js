'use strict';

export const Formatter = {
    fileSize(bytes) {
        if (bytes === 0 || bytes == null) return '—';
        const UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
        const exp = Math.min(Math.floor(Math.log2(bytes) / 10), UNITS.length - 1);
        const val = bytes / Math.pow(1024, exp);

        return `${val.toFixed(exp === 0 ? 0 : 1)} ${UNITS[exp]}`;
    },
    date(isoString) {
        if (!isoString) return '—';
        const d = new Date(isoString);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfFile = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diffDays = Math.round((startOfToday - startOfFile) / 86400000);

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;

        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    },
    pathSegments(path) {
        if (!path || path === '.') return [];

        return path.split('/').filter(Boolean);
    },
    fileIcon(ext) {
        const MAP = {
            pdf: '📄', doc: '📝', docx: '📝', txt: '📃', md: '📃', rtf: '📝',
            xls: '📊', xlsx: '📊', csv: '📊', tsv: '📊',
            ppt: '📽', pptx: '📽',
            jpg: '🖼', jpeg: '🖼', png: '🖼', gif: '🖼', svg: '🖼', webp: '🖼',
            bmp: '🖼', ico: '🖼', tiff: '🖼',
            mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬', webm: '🎬',
            mp3: '🎵', wav: '🎵', flac: '🎵', ogg: '🎵', aac: '🎵',
            zip: '🗜', rar: '🗜', gz: '🗜', tar: '🗜', '7z': '🗜', bz2: '🗜',
            exe: '⚙', dll: '⚙', msi: '⚙', so: '⚙',
            js: '📜', ts: '📜', jsx: '📜', tsx: '📜',
            cs: '📜', py: '📜', java: '📜', cpp: '📜', c: '📜', go: '📜', rs: '📜',
            html: '🌐', htm: '🌐', css: '🎨',
            json: '🔧', xml: '🔧', yaml: '🔧', yml: '🔧', toml: '🔧', ini: '🔧',
            db: '🗃', sqlite: '🗃', sql: '🗃',
        };
        return MAP[(ext || '').toLowerCase()] ?? '📄';
    },
};