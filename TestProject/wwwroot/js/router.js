'use strict';

export const Router = {
    getState() {
        const params = new URLSearchParams(window.location.hash.slice(1));

        return {
            path: params.get('path') ?? '',
            search: params.get('search') ?? '',
            sort: params.get('sort') ?? 'name',
            dir: params.get('dir') ?? 'asc',
        };
    },

    setState(partial) {
        const next = { ...this.getState(), ...partial };
        const params = new URLSearchParams();

        if (next.path) params.set('path', next.path);
        if (next.search) params.set('search', next.search);
        if (next.sort !== 'name') params.set('sort', next.sort);
        if (next.dir !== 'asc') params.set('dir', next.dir);

        const newHash = params.toString();
        const newUrl = newHash ? `#${newHash}` : window.location.pathname;

        // Only push a new history entry when state actually changed,
        // so the Back button doesn't get polluted with no-op entries.
        if (window.location.hash.slice(1) !== newHash) {
            window.history.pushState(null, '', newUrl);
            // pushState does not fire hashchange — dispatch manually so the
            // same onNavigate handler fires for all state transitions.
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
    },

    clearSearch() {
        this.setState({ search: '' });
    },

    onNavigate(callback) {
        const dispatch = () => callback(this.getState());
        window.addEventListener('hashchange', dispatch);
        window.addEventListener('popstate', dispatch);
    },
};