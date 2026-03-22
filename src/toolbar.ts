
let hideTimer: number | undefined;

let toolbar: HTMLDivElement | undefined;

function initToolbar() {
    console.log("> initToolbar");
    toolbar = document.getElementById('toolbar') as HTMLDivElement;
    console.log(">> toolbar", toolbar);
    toolbar.addEventListener('mouseenter', () => {
        if (hideTimer) {
            clearTimeout(hideTimer);
        }
        toolbar?.classList.add('visible');
    });

    toolbar.addEventListener('mouseleave', () => {
        hideToolbarSoon();
    });

    window.addEventListener('mousemove', (e) => {
        if (e.clientY <= 24) {
            showToolbar();
        }
    });
}

function showToolbar() {
    console.log("> showToolbar ", toolbar);

    toolbar?.classList.add('visible');

    if (hideTimer) {
        clearTimeout(hideTimer);
    }

    hideTimer = window.setTimeout(() => {
        if (!toolbar?.matches(':hover')) {
            toolbar?.classList.remove('visible');
        }
    }, 2500);
}

function hideToolbarSoon() {
    console.log("> hideToolbar");
    if (hideTimer) {
        clearTimeout(hideTimer);
    }

    hideTimer = window.setTimeout(() => {
        if (!toolbar?.matches(':hover')) {
            toolbar?.classList.remove('visible');
        }
    }, 800);
}
//
//


export {
    toolbar,
    showToolbar,
    hideToolbarSoon,
    initToolbar
}