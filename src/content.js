/*
 * INVARIANTE:
 * Este módulo controla exclusivamente a interface TabNotes
 * dentro da página atual.
 *
 * - Ctrl+Alt+N mostra/oculta as notas.
 * - Cada nota possui título, texto, posição, tamanho, cor,
 *   fonte, alinhamento e estado próprios.
 * - Notas podem ser movidas e redimensionadas.
 * - Notas minimizadas continuam móveis.
 * - Posição e tamanho de cada nota são persistidos por aba.
 * - Ao recarregar, abas que já possuem notas voltam a exibi-las.
 * - A interface usa Shadow DOM para isolamento do CSS da página.
 */

'use strict';

/**
 * @typedef {'left'|'center'|'right'|'justify'} TextAlignment
 */

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {string} title
 * @property {string} text
 * @property {string} color
 * @property {string[]} customColors
 * @property {number} left
 * @property {number} top
 * @property {number} width
 * @property {number} height
 * @property {number} fontSize
 * @property {number} fontScale
 * @property {TextAlignment} align
 * @property {boolean} toolsOpen
 * @property {boolean} collapsed
 * @property {number|null} collapsedLeft
 * @property {number|null} collapsedTop
 * @property {number} z
 */

/**
 * @typedef {Object} NotesState
 * @property {number} version
 * @property {boolean} visible
 * @property {Note[]} notes
 */

const CONFIG = Object.freeze({
    defaultWidth: 310,
    defaultHeight: 290,

    minWidth: 220,
    minHeight: 170,

    defaultFontSize: 14,
    fontScaleMin: -3,
    fontScaleMax: 3,
    fontSizes: Object.freeze({
        '-3': 11,
        '-2': 12,
        '-1': 13,
        '0': 14,
        '1': 16,
        '2': 19,
        '3': 22,
    }),

    screenMargin: 8,

    collapsedWidth: 190,
    collapsedHeight: 42,

    newNoteOffset: 28,

    saveDebounceMs: 150,
});

const MESSAGE = Object.freeze({
    GET_STATE: 'tabnotes:get-state',
    SAVE_STATE: 'tabnotes:save-state',
});

const ALIGNMENTS = Object.freeze([
    'left',
    'center',
    'right',
    'justify',
]);

const COLORS = Object.freeze([
    // Escuras
    {
        name: 'Cacau Escuro',
        background: '#5B4034',
        border: '#3E2B23',
        text: '#FFFFFF',
    },
    {
        name: 'Terracota Escuro',
        background: '#7A3E2E',
        border: '#552A20',
        text: '#FFFFFF',
    },
    {
        name: 'Mostarda Escuro',
        background: '#6F5B1E',
        border: '#4D3F15',
        text: '#FFFFFF',
    },
    {
        name: 'Oliva Escuro',
        background: '#45512F',
        border: '#303821',
        text: '#FFFFFF',
    },
    {
        name: 'Petróleo Escuro',
        background: '#254F53',
        border: '#19373A',
        text: '#FFFFFF',
    },
    {
        name: 'Ameixa Escuro',
        background: '#54364F',
        border: '#3A2537',
        text: '#FFFFFF',
    },

    // Médias
    {
        name: 'Cacau Médio',
        background: '#A9775D',
        border: '#7C5643',
    },
    {
        name: 'Terracota Médio',
        background: '#C86F50',
        border: '#974F38',
    },
    {
        name: 'Mostarda Médio',
        background: '#C0A13A',
        border: '#8F7629',
    },
    {
        name: 'Oliva Médio',
        background: '#7F9455',
        border: '#5C6D3D',
    },
    {
        name: 'Petróleo Médio',
        background: '#4F8589',
        border: '#386164',
    },
    {
        name: 'Ameixa Médio',
        background: '#8B5F82',
        border: '#66445E',
    },

    // Claras
    {
        name: 'Cacau Claro',
        background: '#E8D4C8',
        border: '#C7AA99',
    },
    {
        name: 'Terracota Claro',
        background: '#F1D1C4',
        border: '#D9A694',
    },
    {
        name: 'Mostarda Claro',
        background: '#F0E3AD',
        border: '#D1BE70',
    },
    {
        name: 'Oliva Claro',
        background: '#DCE5C3',
        border: '#B4C58C',
    },
    {
        name: 'Petróleo Claro',
        background: '#CFE2E3',
        border: '#9DBFC1',
    },
    {
        name: 'Ameixa Claro',
        background: '#E5D2E1',
        border: '#C2A4BB',
    },
]);

const ICONS = Object.freeze({
    color: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M12 4a8 8 0 1 0 0 16h1.15c1.15 0 1.72-1.39.91-2.2-.69-.69-.2-1.86.78-1.86H17A3 3 0 0 0 20 13c0-4.97-3.58-9-8-9Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linejoin="round"
            />
            <circle cx="8.2" cy="10" r="1.1" fill="currentColor" />
            <circle cx="11.1" cy="7.7" r="1.1" fill="currentColor" />
            <circle cx="14.6" cy="8.5" r="1.1" fill="currentColor" />
            <circle cx="16.2" cy="11.6" r="1.1" fill="currentColor" />
        </svg>
    `,

    trash: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M5 7h14"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
            />
            <path
                d="M9 4h6l1 3H8l1-3Z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linejoin="round"
            />
            <path
                d="M7 7l.8 13h8.4L17 7"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linejoin="round"
            />
        </svg>
    `,

    add: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M12 5v14M5 12h14"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
            />
        </svg>
    `,

    expand: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M8 16 16 8"
                fill="none"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
            />
            <path
                d="M10 8h6v6"
                fill="none"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    `,

    chevronUp: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="m7 14 5-5 5 5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    `,

    chevronDown: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="m7 10 5 5 5-5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    `,
});

/** @type {NotesState} */
let state = {
    version: 1,
    visible: false,
    notes: [],
};

/** @type {ShadowRoot|null} */
let shadow = null;

let currentZ = 100;
let saveTimer = null;
let activeNoteEditor = null;

// ============================================================
// UTIL
// ============================================================

function createId() {
    if (
        crypto &&
        typeof crypto.randomUUID ===
            'function'
    ) {
        return crypto.randomUUID();
    }

    return [
        Date.now(),
        Math.random()
            .toString(36)
            .slice(2),
        Math.random()
            .toString(36)
            .slice(2),
    ].join('-');
}

function clamp(
    value,
    min,
    max
) {
    return Math.min(
        max,
        Math.max(
            min,
            value
        )
    );
}

function numericOr(
    value,
    fallback
) {
    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}

function normalizeFontScale(note) {
    const explicitScale =
        Number(note?.fontScale);

    if (Number.isFinite(explicitScale)) {
        return clamp(
            Math.round(explicitScale),
            CONFIG.fontScaleMin,
            CONFIG.fontScaleMax
        );
    }

    const legacySize =
        numericOr(
            note?.fontSize,
            CONFIG.defaultFontSize
        );

    let closestScale = 0;
    let closestDistance = Infinity;

    for (
        let scale = CONFIG.fontScaleMin;
        scale <= CONFIG.fontScaleMax;
        scale += 1
    ) {
        const distance =
            Math.abs(
                fontSizeForScale(scale) -
                legacySize
            );

        if (distance < closestDistance) {
            closestScale = scale;
            closestDistance = distance;
        }
    }

    return closestScale;
}

function fontSizeForScale(scale) {
    const normalizedScale =
        clamp(
            Math.round(
                numericOr(
                    scale,
                    0
                )
            ),
            CONFIG.fontScaleMin,
            CONFIG.fontScaleMax
        );

    return (
        CONFIG.fontSizes[
            String(normalizedScale)
        ] ||
        CONFIG.defaultFontSize
    );
}

function parseHexColor(background) {
    const value =
        String(background || '')
            .trim()
            .replace('#', '');

    if (/^[0-9a-fA-F]{3}$/.test(value)) {
        return [
            parseInt(value[0] + value[0], 16),
            parseInt(value[1] + value[1], 16),
            parseInt(value[2] + value[2], 16),
        ];
    }

    if (/^[0-9a-fA-F]{6}$/.test(value)) {
        return [
            parseInt(value.slice(0, 2), 16),
            parseInt(value.slice(2, 4), 16),
            parseInt(value.slice(4, 6), 16),
        ];
    }

    return null;
}

function textColorForBackground(background) {
    const rgb =
        parseHexColor(
            background
        );

    if (!rgb) {
        return '#1F1A17';
    }

    const [red, green, blue] =
        rgb;

    const luminance =
        (
            red * 299 +
            green * 587 +
            blue * 114
        ) /
        1000;

    return luminance < 150
        ? '#FFFFFF'
        : '#1F1A17';
}

function borderColorForBackground(background) {
    const rgb =
        parseHexColor(
            background
        );

    if (!rgb) {
        return '#5A463A';
    }

    const factor = 0.72;

    return `rgb(${rgb
        .map(
            value =>
                Math.round(
                    value * factor
                )
        )
        .join(', ')})`;
}

function getColor(background) {
    const found =
        COLORS.find(
            color =>
                color.background ===
                background
        );

    const effectiveBackground =
        found?.background ||
        background ||
        COLORS[0].background;

    return {
        name:
            found?.name ||
            'Personalizada',
        background:
            effectiveBackground,
        border:
            found?.border ||
            borderColorForBackground(
                effectiveBackground
            ),
        text:
            found?.text ||
            textColorForBackground(
                effectiveBackground
            ),
    };
}

function normalizeCustomColors(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    const available =
        new Set(
            COLORS.map(
                color =>
                    color.background
            )
        );

    return [
        ...new Set(
            value.filter(
                color =>
                    available.has(
                        color
                    )
            )
        ),
    ].slice(0, COLORS.length);
}

function addCustomColor(
    note,
    background
) {
    const current =
        normalizeCustomColors(
            note.customColors
        );

    if (
        !current.includes(
            background
        )
    ) {
        current.push(
            background
        );
    }

    note.customColors =
        current.slice(
            0,
            COLORS.length
        );
}

function applyColorToCard(
    note,
    card,
    background
) {
    const color =
        getColor(
            background
        );

    note.color =
        color.background;

    card.style.background =
        color.background;

    card.style.borderColor =
        color.border;

    card.style.setProperty(
        '--tn-text-color',
        color.text
    );

    card.style.color =
        color.text;
}

// ============================================================
// STORAGE
// ============================================================

async function loadState() {
    try {
        const response =
            await chrome.runtime.sendMessage({
                type:
                    MESSAGE.GET_STATE,
            });

        if (
            response?.ok &&
            response.state
        ) {
            state =
                normalizeState(
                    response.state
                );

            /*
             * Se a aba já possui notas, elas reaparecem
             * automaticamente após reload/navegação.
             * Sem notas, a interface continua oculta até
             * Ctrl+Alt+N.
             */
            state.visible =
                state.notes.length > 0;
        }
    } catch (error) {
        console.error(
            '[TabNotes] Falha ao carregar estado.',
            error
        );
    }
}

async function saveState() {
    try {
        await chrome.runtime.sendMessage({
            type:
                MESSAGE.SAVE_STATE,

            state: {
                ...state,
                visible: false,
            },
        });
    } catch (error) {
        console.error(
            '[TabNotes] Falha ao salvar.',
            error
        );
    }
}

function scheduleSave() {
    clearTimeout(
        saveTimer
    );

    saveTimer =
        setTimeout(
            saveState,
            CONFIG.saveDebounceMs
        );
}

function normalizeState(
    rawState
) {
    const rawNotes =
        Array.isArray(
            rawState?.notes
        )
            ? rawState.notes
            : [];

    const notes =
        rawNotes
            .filter(
                note =>
                    note &&
                    note.id
            )
            .map(note => ({
                id:
                    String(
                        note.id
                    ),

                title:
                    String(
                        note.title ||
                        ''
                    ),

                text:
                    String(
                        note.text ||
                        ''
                    ),

                color:
                    note.color ||
                    COLORS[0].background,

                customColors:
                    normalizeCustomColors(
                        note.customColors
                    ),

                left:
                    numericOr(
                        note.left,
                        20
                    ),

                top:
                    numericOr(
                        note.top,
                        60
                    ),

                width:
                    Math.max(
                        CONFIG.minWidth,
                        numericOr(
                            note.width,
                            CONFIG.defaultWidth
                        )
                    ),

                height:
                    Math.max(
                        CONFIG.minHeight,
                        numericOr(
                            note.height,
                            CONFIG.defaultHeight
                        )
                    ),

                fontScale:
                    normalizeFontScale(
                        note
                    ),

                fontSize:
                    fontSizeForScale(
                        normalizeFontScale(
                            note
                        )
                    ),

                align:
                    ALIGNMENTS.includes(
                        note.align
                    )
                        ? note.align
                        : 'left',

                toolsOpen:
                    Boolean(
                        note.toolsOpen
                    ),

                collapsed:
                    Boolean(
                        note.collapsed
                    ),

                collapsedLeft:
                    Number.isFinite(
                        Number(
                            note.collapsedLeft
                        )
                    )
                        ? Number(
                            note.collapsedLeft
                        )
                        : null,

                collapsedTop:
                    Number.isFinite(
                        Number(
                            note.collapsedTop
                        )
                    )
                        ? Number(
                            note.collapsedTop
                        )
                        : null,

                z:
                    numericOr(
                        note.z,
                        100
                    ),
            }));

    currentZ =
        Math.max(
            100,
            ...notes.map(
                note =>
                    note.z
            )
        );

    return {
        version: 1,
        visible:
            Boolean(
                rawState?.visible
            ),
        notes,
    };
}

function activateNoteEditor(editor) {
    if (
        !(editor instanceof HTMLInputElement) &&
        !(editor instanceof HTMLTextAreaElement)
    ) {
        return;
    }

    activeNoteEditor = editor;

    try {
        editor.focus({
            preventScroll: true,
        });
    } catch {
        editor.focus();
    }
}

function clearActiveNoteEditor() {
    activeNoteEditor = null;
}

function protectEditorEvents(editor) {
    const eventTypes = [
        'keydown',
        'keyup',
        'keypress',
        'beforeinput',
        'compositionstart',
        'compositionupdate',
        'compositionend',
    ];

    for (const eventType of eventTypes) {
        editor.addEventListener(
            eventType,
            event => {
                event.stopPropagation();
            }
        );
    }

    editor.addEventListener(
        'focus',
        () => {
            activeNoteEditor = editor;
        }
    );
}

function configureEditorFocusGuard() {
    window.addEventListener(
        'keydown',
        event => {
            if (
                !activeNoteEditor ||
                !activeNoteEditor.isConnected
            ) {
                clearActiveNoteEditor();
                return;
            }

            if (
                event.code === 'KeyN' &&
                event.ctrlKey &&
                event.altKey &&
                !event.shiftKey
            ) {
                return;
            }

            if (
                shadow?.activeElement !==
                activeNoteEditor
            ) {
                activateNoteEditor(
                    activeNoteEditor
                );
            }
        },
        true
    );
}

// ============================================================
// SHORTCUT
// ============================================================

function configureShortcut() {
    window.addEventListener(
        'keydown',
        event => {
            if (
                event.code !== 'KeyN' ||
                !event.ctrlKey ||
                !event.altKey ||
                event.shiftKey
            ) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            state.visible = !state.visible;

            render();
        },
        true
    );
}

// ============================================================
// NOTE
// ============================================================

function createNote() {
    const index =
        state.notes.length;

    const offset =
        Math.min(
            index *
                CONFIG.newNoteOffset,
            190
        );

    const width =
        Math.min(
            CONFIG.defaultWidth,
            window.innerWidth -
                CONFIG.screenMargin * 2
        );

    const height =
        Math.min(
            CONFIG.defaultHeight,
            window.innerHeight -
                CONFIG.screenMargin * 2
        );

    currentZ += 1;

    /** @type {Note} */
    const note = {
        id:
            createId(),

        title: '',
        text: '',

        color:
            COLORS[
                index %
                COLORS.length
            ].background,

        customColors: [],

        left:
            Math.max(
                CONFIG.screenMargin,
                window.innerWidth -
                    width -
                    20 -
                    offset
            ),

        top:
            Math.max(
                CONFIG.screenMargin,
                Math.min(
                    60 + offset,
                    window.innerHeight -
                        height -
                        CONFIG.screenMargin
                )
            ),

        width,
        height,

        fontSize:
            CONFIG.defaultFontSize,

        fontScale: 0,

        align:
            'left',

        toolsOpen:
            false,

        collapsed:
            false,

        collapsedLeft:
            null,

        collapsedTop:
            null,

        z:
            currentZ,
    };

    state.notes.push(
        note
    );

    saveState();
    render();

    requestAnimationFrame(
        () => {
            shadow
                ?.querySelector(
                    `[data-note-id="${note.id}"] .tn-title`
                )
                ?.focus();
        }
    );
}

function deleteNote(
    noteId
) {
    state.notes =
        state.notes.filter(
            note =>
                note.id !==
                noteId
        );

    saveState();
    render();
}

function bringToFront(
    note
) {
    currentZ += 1;
    note.z = currentZ;

    const element =
        shadow?.querySelector(
            `[data-note-id="${note.id}"]`
        );

    if (element) {
        element.style.zIndex =
            String(
                note.z
            );
    }

    scheduleSave();
}

// ============================================================
// POSITION
// ============================================================

function constrainNote(
    note
) {
    const maxLeft =
        Math.max(
            CONFIG.screenMargin,
            window.innerWidth -
                note.width -
                CONFIG.screenMargin
        );

    const maxTop =
        Math.max(
            CONFIG.screenMargin,
            window.innerHeight -
                note.height -
                CONFIG.screenMargin
        );

    note.left =
        clamp(
            note.left,
            CONFIG.screenMargin,
            maxLeft
        );

    note.top =
        clamp(
            note.top,
            CONFIG.screenMargin,
            maxTop
        );
}

function constrainCollapsed(
    note
) {
    note.collapsedLeft =
        clamp(
            note.collapsedLeft,
            CONFIG.screenMargin,
            Math.max(
                CONFIG.screenMargin,
                window.innerWidth -
                    CONFIG.collapsedWidth -
                    CONFIG.screenMargin
            )
        );

    note.collapsedTop =
        clamp(
            note.collapsedTop,
            CONFIG.screenMargin,
            Math.max(
                CONFIG.screenMargin,
                window.innerHeight -
                    CONFIG.collapsedHeight -
                    CONFIG.screenMargin
            )
        );
}

// ============================================================
// ICONS
// ============================================================

function alignmentIcon(
    alignment
) {
    const paths = {
        left: [
            'M5 7h14',
            'M5 11h9',
            'M5 15h14',
            'M5 19h8',
        ],

        center: [
            'M5 7h14',
            'M7.5 11h9',
            'M5 15h14',
            'M8 19h8',
        ],

        right: [
            'M5 7h14',
            'M10 11h9',
            'M5 15h14',
            'M11 19h8',
        ],

        justify: [
            'M5 7h14',
            'M5 11h14',
            'M5 15h14',
            'M5 19h14',
        ],
    };

    return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            ${paths[alignment]
                .map(
                    path => `
                        <path
                            d="${path}"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.7"
                            stroke-linecap="round"
                        />
                    `
                )
                .join('')}
        </svg>
    `;
}

// ============================================================
// UI HELPERS
// ============================================================

function createIconButton(
    icon,
    title,
    extraClass = ''
) {
    const button =
        document.createElement(
            'button'
        );

    button.type =
        'button';

    button.className =
        `tn-icon-button ${extraClass}`
            .trim();

    button.title =
        title;

    button.innerHTML =
        icon;

    return button;
}

function closePalettes() {
    shadow
        ?.querySelectorAll(
            '.tn-palette.open'
        )
        .forEach(
            palette => {
                palette.classList.remove(
                    'open'
                );
            }
        );
}

// ============================================================
// EMPTY BUTTON
// ============================================================

function createNotesButton() {
    const button =
        document.createElement(
            'button'
        );

    button.id =
        'tn-notes-button';

    button.type =
        'button';

    button.textContent =
        'Notas';

    button.addEventListener(
        'click',
        event => {
            event.stopPropagation();

            createNote();
        }
    );

    return button;
}

// ============================================================
// COLOR PALETTE
// ============================================================

function createPalette(
    note,
    card,
    onColorSelected
) {
    const palette =
        document.createElement(
            'div'
        );

    palette.className =
        'tn-palette';

    for (
        const color of COLORS
    ) {
        const option =
            document.createElement(
                'button'
            );

        option.type =
            'button';

        option.className =
            'tn-color-option';

        option.title =
            color.name;

        option.dataset.color =
            color.background;

        option.style.background =
            color.background;

        if (
            note.color ===
            color.background
        ) {
            option.classList.add(
                'selected'
            );
        }

        option.addEventListener(
            'pointerdown',
            event => {
                event.stopPropagation();
            }
        );

        option.addEventListener(
            'click',
            event => {
                event.preventDefault();
                event.stopPropagation();

                applyColorToCard(
                    note,
                    card,
                    color.background
                );

                addCustomColor(
                    note,
                    color.background
                );

                palette
                    .querySelectorAll(
                        '.tn-color-option'
                    )
                    .forEach(
                        item => {
                            item.classList.toggle(
                                'selected',
                                item.dataset.color ===
                                    note.color
                            );
                        }
                    );

                palette.classList.remove(
                    'open'
                );

                if (
                    typeof onColorSelected ===
                    'function'
                ) {
                    onColorSelected();
                }

                saveState();
            }
        );

        palette.appendChild(
            option
        );
    }

    return palette;
}

// ============================================================
// COLLAPSED NOTE
// ============================================================

function createCollapsedNote(
    note,
    index
) {
    if (
        note.collapsedLeft ===
            null ||
        note.collapsedTop ===
            null
    ) {
        note.collapsedLeft =
            Math.max(
                CONFIG.screenMargin,
                window.innerWidth -
                    CONFIG.collapsedWidth -
                    18
            );

        note.collapsedTop =
            18 +
            index *
                (
                    CONFIG.collapsedHeight +
                    8
                );
    }

    constrainCollapsed(
        note
    );

    const color =
        getColor(
            note.color
        );

    const container =
        document.createElement(
            'div'
        );

    container.className =
        'tn-collapsed';

    container.dataset.noteId =
        note.id;

    Object.assign(
        container.style,
        {
            left:
                `${note.collapsedLeft}px`,

            top:
                `${note.collapsedTop}px`,

            background:
                color.background,

            borderColor:
                color.border,

            color:
                color.text,

            zIndex:
                String(
                    note.z
                ),
        }
    );

    container.style.setProperty(
        '--tn-text-color',
        color.text
    );

    const title =
        document.createElement(
            'div'
        );

    title.className =
        'tn-collapsed-title';

    title.textContent =
        note.title.trim() ||
        'Nota';

    const expand =
        document.createElement(
            'button'
        );

    expand.type =
        'button';

    expand.className =
        'tn-expand';

    expand.title =
        'Expandir nota';

    expand.innerHTML =
        ICONS.expand;

    expand.addEventListener(
        'pointerdown',
        event => {
            event.stopPropagation();
        }
    );

    expand.addEventListener(
        'click',
        event => {
            event.preventDefault();
            event.stopPropagation();

            note.collapsed =
                false;

            bringToFront(
                note
            );

            saveState();
            render();
        }
    );

    container.append(
        title,
        expand
    );

    configureCollapsedDrag(
        container,
        note
    );

    return container;
}

function configureCollapsedDrag(
    element,
    note
) {
    element.addEventListener(
        'pointerdown',
        event => {
            if (
                event.button !== 0 ||
                event.target.closest(
                    'button'
                )
            ) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            bringToFront(
                note
            );

            const startX =
                event.clientX;

            const startY =
                event.clientY;

            const startLeft =
                note.collapsedLeft;

            const startTop =
                note.collapsedTop;

            element.setPointerCapture(
                event.pointerId
            );

            function move(
                moveEvent
            ) {
                note.collapsedLeft =
                    startLeft +
                    (
                        moveEvent.clientX -
                        startX
                    );

                note.collapsedTop =
                    startTop +
                    (
                        moveEvent.clientY -
                        startY
                    );

                constrainCollapsed(
                    note
                );

                element.style.left =
                    `${note.collapsedLeft}px`;

                element.style.top =
                    `${note.collapsedTop}px`;

                scheduleSave();
            }

            function finish() {
                element.removeEventListener(
                    'pointermove',
                    move
                );

                element.removeEventListener(
                    'pointerup',
                    finish
                );

                element.removeEventListener(
                    'pointercancel',
                    finish
                );

                saveState();
            }

            element.addEventListener(
                'pointermove',
                move
            );

            element.addEventListener(
                'pointerup',
                finish
            );

            element.addEventListener(
                'pointercancel',
                finish
            );
        }
    );
}

// ============================================================
// OPEN NOTE
// ============================================================

function createNoteCard(
    note
) {
    constrainNote(
        note
    );

    const color =
        getColor(
            note.color
        );

    const card =
        document.createElement(
            'div'
        );

    card.className =
        'tn-card';

    card.dataset.noteId =
        note.id;

    Object.assign(
        card.style,
        {
            left:
                `${note.left}px`,

            top:
                `${note.top}px`,

            width:
                `${note.width}px`,

            height:
                `${note.height}px`,

            background:
                color.background,

            borderColor:
                color.border,

            color:
                color.text,

            zIndex:
                String(
                    note.z
                ),
        }
    );

    card.style.setProperty(
        '--tn-text-color',
        color.text
    );

    card.addEventListener(
        'pointerdown',
        event => {
            bringToFront(
                note
            );

            const target =
                event.target;

            if (
                target instanceof Element &&
                target.closest(
                    'input, textarea, button, .tn-palette, .tn-resize'
                )
            ) {
                return;
            }

            requestAnimationFrame(
                () => {
                    activateNoteEditor(
                        textarea
                    );
                }
            );
        }
    );

    // --------------------------------------------------------
    // HEADER
    // --------------------------------------------------------

    const header =
        document.createElement(
            'div'
        );

    header.className =
        'tn-header';

    const title =
        document.createElement(
            'input'
        );

    title.className =
        'tn-title';

    title.type =
        'text';

    title.placeholder =
        'Título';

    title.value =
        note.title;

    title.addEventListener(
        'input',
        () => {
            note.title =
                title.value;

            scheduleSave();
        }
    );

    title.addEventListener(
        'pointerdown',
        event => {
            event.stopPropagation();
            activateNoteEditor(
                title
            );
        }
    );

    title.addEventListener(
        'click',
        event => {
            event.stopPropagation();
            activateNoteEditor(
                title
            );
        }
    );

    protectEditorEvents(
        title
    );

    const headerActions =
        document.createElement(
            'div'
        );

    headerActions.className =
        'tn-header-actions';

    const add =
        createIconButton(
            ICONS.add,
            'Adicionar outra nota',
            'tn-header-add'
        );

    add.addEventListener(
        'pointerdown',
        event => {
            event.stopPropagation();
        }
    );

    add.addEventListener(
        'click',
        event => {
            event.stopPropagation();
            createNote();
        }
    );

    const collapse =
        document.createElement(
            'button'
        );

    collapse.type =
        'button';

    collapse.className =
        'tn-collapse';

    collapse.textContent =
        '−';

    collapse.title =
        'Minimizar nota';

    collapse.addEventListener(
        'pointerdown',
        event => {
            event.stopPropagation();
        }
    );

    collapse.addEventListener(
        'click',
        event => {
            event.stopPropagation();

            note.collapsedLeft =
                clamp(
                    note.left,
                    CONFIG.screenMargin,
                    Math.max(
                        CONFIG.screenMargin,
                        window.innerWidth -
                            CONFIG.collapsedWidth -
                            CONFIG.screenMargin
                    )
                );

            note.collapsedTop =
                clamp(
                    note.top,
                    CONFIG.screenMargin,
                    Math.max(
                        CONFIG.screenMargin,
                        window.innerHeight -
                            CONFIG.collapsedHeight -
                            CONFIG.screenMargin
                    )
                );

            note.collapsed =
                true;

            saveState();
            render();
        }
    );

    headerActions.append(
        add,
        collapse
    );

    header.append(
        title,
        headerActions
    );

    configureCardDrag(
        header,
        card,
        note
    );

    // --------------------------------------------------------
    // TEXT
    // --------------------------------------------------------

    const textarea =
        document.createElement(
            'textarea'
        );

    textarea.className =
        'tn-text';

    textarea.placeholder =
        'Escreva sua nota...';

    textarea.spellcheck =
        true;

    textarea.value =
        note.text;

    textarea.style.fontSize =
        `${note.fontSize}px`;

    textarea.style.textAlign =
        note.align;

    textarea.addEventListener(
        'input',
        () => {
            note.text =
                textarea.value;

            scheduleSave();
        }
    );

    textarea.addEventListener(
        'pointerdown',
        event => {
            event.stopPropagation();

            bringToFront(
                note
            );

            activateNoteEditor(
                textarea
            );
        }
    );

    textarea.addEventListener(
        'click',
        event => {
            event.stopPropagation();
            activateNoteEditor(
                textarea
            );
        }
    );

    protectEditorEvents(
        textarea
    );

    // --------------------------------------------------------
    // PALETTE
    // --------------------------------------------------------

    const palette =
        createPalette(
            note,
            card,
            () => {
                renderCustomColors();
            }
        );

    // --------------------------------------------------------
    // TOOLS
    // --------------------------------------------------------

    const tools =
        document.createElement(
            'div'
        );

    tools.className =
        'tn-tools';

    if (
        !note.toolsOpen
    ) {
        tools.classList.add(
            'hidden'
        );
    }

    const fontBox =
        document.createElement(
            'div'
        );

    fontBox.className =
        'tn-font-box';

    const fontPlus =
        document.createElement(
            'button'
        );

    fontPlus.type =
        'button';

    fontPlus.className =
        'tn-font-action';

    fontPlus.textContent =
        '+';

    fontPlus.title =
        'Aumentar fonte';

    const fontMinus =
        document.createElement(
            'button'
        );

    fontMinus.type =
        'button';

    fontMinus.className =
        'tn-font-action';

    fontMinus.textContent =
        '−';

    fontMinus.title =
        'Diminuir fonte';

    function updateFontControls() {
        note.fontScale = clamp(
            numericOr(
                note.fontScale,
                0
            ),
            CONFIG.fontScaleMin,
            CONFIG.fontScaleMax
        );

        note.fontSize =
            fontSizeForScale(
                note.fontScale
            );

        fontMinus.disabled =
            note.fontScale <=
            CONFIG.fontScaleMin;

        fontPlus.disabled =
            note.fontScale >=
            CONFIG.fontScaleMax;

        textarea.style.fontSize =
            `${note.fontSize}px`;
    }

    fontPlus.addEventListener(
        'click',
        event => {
            event.stopPropagation();

            note.fontScale =
                Math.min(
                    CONFIG.fontScaleMax,
                    note.fontScale + 1
                );

            updateFontControls();
            saveState();
        }
    );

    fontMinus.addEventListener(
        'click',
        event => {
            event.stopPropagation();

            note.fontScale =
                Math.max(
                    CONFIG.fontScaleMin,
                    note.fontScale - 1
                );

            updateFontControls();
            saveState();
        }
    );

    fontBox.append(
        fontPlus,
        fontMinus
    );

    updateFontControls();

    const align =
        createIconButton(
            alignmentIcon(
                note.align
            ),
            'Alterar alinhamento'
        );

    align.addEventListener(
        'click',
        event => {
            event.stopPropagation();

            const currentIndex =
                ALIGNMENTS.indexOf(
                    note.align
                );

            note.align =
                ALIGNMENTS[
                    (
                        currentIndex + 1
                    ) %
                    ALIGNMENTS.length
                ];

            textarea.style.textAlign =
                note.align;

            align.innerHTML =
                alignmentIcon(
                    note.align
                );

            saveState();
        }
    );

    const colorBox =
        document.createElement(
            'div'
        );

    colorBox.className =
        'tn-color-box';

    const colorButton =
        createIconButton(
            ICONS.color,
            'Adicionar ou alterar cor',
            'tn-color-button'
        );

    const customColors =
        document.createElement(
            'div'
        );

    customColors.className =
        'tn-custom-colors';

    function renderCustomColors() {
        customColors.replaceChildren();

        note.customColors =
            normalizeCustomColors(
                note.customColors
            );

        for (
            const background of
                note.customColors
        ) {
            const color =
                getColor(
                    background
                );

            const swatch =
                document.createElement(
                    'button'
                );

            swatch.type =
                'button';

            swatch.className =
                'tn-custom-color';

            swatch.title =
                color.name;

            swatch.style.background =
                color.background;

            swatch.classList.toggle(
                'selected',
                note.color ===
                    background
            );

            swatch.addEventListener(
                'pointerdown',
                event => {
                    event.stopPropagation();
                }
            );

            swatch.addEventListener(
                'click',
                event => {
                    event.preventDefault();
                    event.stopPropagation();

                    applyColorToCard(
                        note,
                        card,
                        background
                    );

                    palette
                        .querySelectorAll(
                            '.tn-color-option'
                        )
                        .forEach(
                            option => {
                                option.classList.toggle(
                                    'selected',
                                    option.dataset.color ===
                                        note.color
                                );
                            }
                        );

                    closePalettes();
                    renderCustomColors();
                    saveState();
                }
            );

            customColors.appendChild(
                swatch
            );
        }
    }

    renderCustomColors();

    colorButton.addEventListener(
        'pointerdown',
        event => {
            event.stopPropagation();
        }
    );

    colorButton.addEventListener(
        'click',
        event => {
            event.preventDefault();
            event.stopPropagation();

            const wasOpen =
                palette.classList.contains(
                    'open'
                );

            closePalettes();

            if (!wasOpen) {
                palette.classList.add(
                    'open'
                );
            }
        }
    );

    colorBox.append(
        colorButton,
        customColors
    );

    const trash =
        createIconButton(
            ICONS.trash,
            'Apagar nota',
            'tn-trash'
        );

    trash.addEventListener(
        'click',
        event => {
            event.stopPropagation();

            deleteNote(
                note.id
            );
        }
    );

    tools.append(
        fontBox,
        align,
        colorBox,
        trash
    );

    // --------------------------------------------------------
    // TOOLS TOGGLE
    // --------------------------------------------------------

    const toolsToggle =
        document.createElement(
            'button'
        );

    toolsToggle.type =
        'button';

    toolsToggle.className =
        'tn-tools-toggle';

    function updateToolsToggle() {
        toolsToggle.innerHTML =
            note.toolsOpen
                ? ICONS.chevronDown
                : ICONS.chevronUp;

        toolsToggle.title =
            note.toolsOpen
                ? 'Fechar ferramentas'
                : 'Abrir ferramentas';
    }

    updateToolsToggle();

    toolsToggle.addEventListener(
        'pointerdown',
        event => {
            event.stopPropagation();
        }
    );

    toolsToggle.addEventListener(
        'click',
        event => {
            event.stopPropagation();

            note.toolsOpen =
                !note.toolsOpen;

            tools.classList.toggle(
                'hidden',
                !note.toolsOpen
            );

            if (
                !note.toolsOpen
            ) {
                palette.classList.remove(
                    'open'
                );
            }

            updateToolsToggle();
            saveState();
        }
    );

    card.append(
        header,
        textarea,
        tools,
        palette,
        toolsToggle
    );

    addResizeHandles(
        card,
        note
    );

    return card;
}

// ============================================================
// DRAG OPEN NOTE
// ============================================================

function configureCardDrag(
    handle,
    card,
    note
) {
    handle.addEventListener(
        'pointerdown',
        event => {
            if (
                event.button !== 0 ||
                event.target.closest(
                    'input, button'
                )
            ) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            bringToFront(
                note
            );

            const startX =
                event.clientX;

            const startY =
                event.clientY;

            const startLeft =
                note.left;

            const startTop =
                note.top;

            handle.setPointerCapture(
                event.pointerId
            );

            function move(
                moveEvent
            ) {
                note.left =
                    startLeft +
                    (
                        moveEvent.clientX -
                        startX
                    );

                note.top =
                    startTop +
                    (
                        moveEvent.clientY -
                        startY
                    );

                constrainNote(
                    note
                );

                card.style.left =
                    `${note.left}px`;

                card.style.top =
                    `${note.top}px`;

                scheduleSave();
            }

            function finish() {
                handle.removeEventListener(
                    'pointermove',
                    move
                );

                handle.removeEventListener(
                    'pointerup',
                    finish
                );

                handle.removeEventListener(
                    'pointercancel',
                    finish
                );

                saveState();
            }

            handle.addEventListener(
                'pointermove',
                move
            );

            handle.addEventListener(
                'pointerup',
                finish
            );

            handle.addEventListener(
                'pointercancel',
                finish
            );
        }
    );
}

// ============================================================
// RESIZE
// ============================================================

function addResizeHandles(
    card,
    note
) {
    const directions = [
        'n',
        's',
        'e',
        'w',
        'ne',
        'nw',
        'se',
        'sw',
    ];

    for (
        const direction of
            directions
    ) {
        const handle =
            document.createElement(
                'div'
            );

        handle.className =
            [
                'tn-resize',
                `tn-resize-${direction}`,
            ].join(' ');

        configureResize(
            handle,
            card,
            note,
            direction
        );

        card.appendChild(
            handle
        );
    }
}

function configureResize(
    handle,
    card,
    note,
    direction
) {
    handle.addEventListener(
        'pointerdown',
        event => {
            if (
                event.button !== 0
            ) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            bringToFront(
                note
            );

            const startX =
                event.clientX;

            const startY =
                event.clientY;

            const initial = {
                left:
                    note.left,

                top:
                    note.top,

                width:
                    note.width,

                height:
                    note.height,
            };

            handle.setPointerCapture(
                event.pointerId
            );

            function move(
                moveEvent
            ) {
                const dx =
                    moveEvent.clientX -
                    startX;

                const dy =
                    moveEvent.clientY -
                    startY;

                let left =
                    initial.left;

                let top =
                    initial.top;

                let width =
                    initial.width;

                let height =
                    initial.height;

                if (
                    direction.includes(
                        'e'
                    )
                ) {
                    width =
                        clamp(
                            initial.width +
                                dx,
                            CONFIG.minWidth,
                            window.innerWidth -
                                initial.left -
                                CONFIG.screenMargin
                        );
                }

                if (
                    direction.includes(
                        's'
                    )
                ) {
                    height =
                        clamp(
                            initial.height +
                                dy,
                            CONFIG.minHeight,
                            window.innerHeight -
                                initial.top -
                                CONFIG.screenMargin
                        );
                }

                if (
                    direction.includes(
                        'w'
                    )
                ) {
                    const right =
                        initial.left +
                        initial.width;

                    width =
                        clamp(
                            initial.width -
                                dx,
                            CONFIG.minWidth,
                            right -
                                CONFIG.screenMargin
                        );

                    left =
                        right -
                        width;
                }

                if (
                    direction.includes(
                        'n'
                    )
                ) {
                    const bottom =
                        initial.top +
                        initial.height;

                    height =
                        clamp(
                            initial.height -
                                dy,
                            CONFIG.minHeight,
                            bottom -
                                CONFIG.screenMargin
                        );

                    top =
                        bottom -
                        height;
                }

                note.left =
                    Math.round(
                        left
                    );

                note.top =
                    Math.round(
                        top
                    );

                note.width =
                    Math.round(
                        width
                    );

                note.height =
                    Math.round(
                        height
                    );

                card.style.left =
                    `${note.left}px`;

                card.style.top =
                    `${note.top}px`;

                card.style.width =
                    `${note.width}px`;

                card.style.height =
                    `${note.height}px`;

                scheduleSave();
            }

            function finish() {
                handle.removeEventListener(
                    'pointermove',
                    move
                );

                handle.removeEventListener(
                    'pointerup',
                    finish
                );

                handle.removeEventListener(
                    'pointercancel',
                    finish
                );

                saveState();
            }

            handle.addEventListener(
                'pointermove',
                move
            );

            handle.addEventListener(
                'pointerup',
                finish
            );

            handle.addEventListener(
                'pointercancel',
                finish
            );
        }
    );
}

// ============================================================
// RENDER
// ============================================================

function clearInterface() {
    shadow
        ?.querySelectorAll(
            [
                '.tn-card',
                '.tn-collapsed',
                '#tn-notes-button',
            ].join(',')
        )
        .forEach(
            element => {
                element.remove();
            }
        );
}

function render() {
    if (!shadow) {
        return;
    }

    clearInterface();

    if (
        !state.visible
    ) {
        return;
    }

    if (
        !state.notes.length
    ) {
        shadow.appendChild(
            createNotesButton()
        );

        return;
    }

    let collapsedIndex = 0;

    for (
        const note of
            state.notes
    ) {
        if (
            note.collapsed
        ) {
            shadow.appendChild(
                createCollapsedNote(
                    note,
                    collapsedIndex
                )
            );

            collapsedIndex += 1;

            continue;
        }

        shadow.appendChild(
            createNoteCard(
                note
            )
        );
    }
}

// ============================================================
// VIEWPORT
// ============================================================

function adjustToViewport() {
    for (
        const note of
            state.notes
    ) {
        if (
            note.collapsed
        ) {
            if (
                note.collapsedLeft !==
                    null &&
                note.collapsedTop !==
                    null
            ) {
                constrainCollapsed(
                    note
                );
            }

            continue;
        }

        note.width =
            Math.min(
                note.width,
                Math.max(
                    CONFIG.minWidth,
                    window.innerWidth -
                        CONFIG.screenMargin *
                            2
                )
            );

        note.height =
            Math.min(
                note.height,
                Math.max(
                    CONFIG.minHeight,
                    window.innerHeight -
                        CONFIG.screenMargin *
                            2
                )
            );

        constrainNote(
            note
        );
    }

    saveState();

    if (
        state.visible
    ) {
        render();
    }
}

// ============================================================
// CSS
// ============================================================

async function loadStyles() {
    const response =
        await fetch(
            chrome.runtime.getURL(
                'src/styles.css'
            )
        );

    if (
        !response.ok
    ) {
        throw new Error(
            `CSS_LOAD_FAILED_${response.status}`
        );
    }

    return response.text();
}

// ============================================================
// START
// ============================================================

async function start() {
    if (
        document.getElementById(
            'tabnotes-extension-host'
        )
    ) {
        return;
    }

    await loadState();

    const host =
        document.createElement(
            'div'
        );

    host.id =
        'tabnotes-extension-host';

    Object.assign(
        host.style,
        {
            position: 'fixed',
            inset: '0',
            width: '0',
            height: '0',
            zIndex: '2147483647',
            pointerEvents: 'none',
        }
    );

    shadow =
        host.attachShadow({
            mode: 'open',
        });

    const style =
        document.createElement(
            'style'
        );

    style.textContent =
        await loadStyles();

    shadow.appendChild(
        style
    );

    document.documentElement.appendChild(
        host
    );

    configureShortcut();
    configureEditorFocusGuard();

    document.addEventListener(
        'pointerdown',
        event => {
            const path =
                event.composedPath();

            const clickedPalette =
                path.some(
                    element =>
                        element
                            ?.classList
                            ?.contains(
                                'tn-palette'
                            )
                );

            const clickedColorButton =
                path.some(
                    element =>
                        element
                            ?.classList
                            ?.contains(
                                'tn-color-button'
                            )
                );

            const clickedHost =
                path.includes(
                    host
                );

            if (!clickedHost) {
                clearActiveNoteEditor();
            }

            if (
                !clickedPalette &&
                !clickedColorButton
            ) {
                closePalettes();
            }
        },
        true
    );

    let resizeTimer = null;

    window.addEventListener(
        'resize',
        () => {
            clearTimeout(
                resizeTimer
            );

            resizeTimer =
                setTimeout(
                    adjustToViewport,
                    150
                );
        }
    );

    render();

    console.log(
        '[TabNotes] carregado. Ctrl+Alt+N mostra/oculta.'
    );
}

start().catch(
    error => {
        console.error(
            '[TabNotes] Falha ao iniciar.',
            error
        );
    }
);