// js/events.js

import * as UI from './ui.js';
import * as State from './state.js';

export function initEvents() {
    // 1. Sort Dropdown
    document.getElementById('categorySortSelect')?.addEventListener('change', UI.applyCategorySort);

    // 2. Tab Navigation
    document.querySelectorAll('.cmd-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const viewName = e.target.id.replace('tab-', '');
            UI.switchTab(viewName);
        });
    });

    // 3. Form Reset
    document.getElementById('resetFormBtn')?.addEventListener('click', UI.hardResetForm);
}
// --- SMART ICON AUTO-FILLER ---
    document.body.addEventListener('input', (e) => {
        // 1. Check if the user is typing in ANY of our name inputs
        const targetId = e.target.id;
        if (targetId === 'catInputName' || targetId === 'newIncName' || targetId === 'newDebtName') {

            // 2. Dynamically find the matching Icon input for this specific modal
            const iconFieldId = targetId.replace('Name', 'Icon');
            const iconInput = document.getElementById(iconFieldId);

            // 3. Run the keyword map and update the UI instantly
            if (iconInput) {
                iconInput.value = window.getIconFromName(e.target.value);
            }
        }
    });
