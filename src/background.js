/*
 * INVARIANTE:
 * Este módulo é a autoridade sobre o estado por aba.
 *
 * - Nunca mistura estados entre abas.
 * - Nunca depende da URL atual da página.
 * - Abas normais persistem em chrome.storage.local.
 * - Abas anônimas usam somente chrome.storage.session.
 * - Dados anônimos nunca são persistidos em disco.
 * - Ao fechar uma aba, remove exclusivamente os dados
 *   associados ao respectivo tabId.
 */

'use strict';

const STORAGE_PREFIX = 'tabnotes:';

const MESSAGE = Object.freeze({
    GET_STATE: 'tabnotes:get-state',
    SAVE_STATE: 'tabnotes:save-state',
});

function storageKey(
    tabId,
    incognito
) {
    const contexto =
        incognito
            ? 'incognito'
            : 'regular';

    return (
        `${STORAGE_PREFIX}` +
        `${contexto}:tab:${tabId}`
    );
}

function obterStorage(
    incognito
) {
    return incognito
        ? chrome.storage.session
        : chrome.storage.local;
}

function estadoVazio() {
    return {
        version: 1,
        visible: false,
        notes: [],
    };
}

chrome.runtime.onMessage.addListener(
    (
        message,
        sender,
        sendResponse
    ) => {
        const tabId =
            sender.tab?.id;

        const incognito =
            sender.tab?.incognito ===
            true;

        if (
            !Number.isInteger(
                tabId
            )
        ) {
            sendResponse({
                ok: false,
                error:
                    'TAB_ID_UNAVAILABLE',
            });

            return false;
        }

        const storage =
            obterStorage(
                incognito
            );

        const key =
            storageKey(
                tabId,
                incognito
            );

        // ========================================================
        // GET
        // ========================================================

        if (
            message?.type ===
            MESSAGE.GET_STATE
        ) {
            storage
                .get(key)
                .then(result => {
                    const state =
                        result[key] ||
                        estadoVazio();

                    /*
                     * A visibilidade não é autoridade deste módulo.
                     * O content script decide na inicialização:
                     * notas existentes reaparecem; aba vazia inicia oculta.
                     */

                    sendResponse({
                        ok: true,
                        state,
                        incognito,
                    });
                })
                .catch(error => {
                    console.error(
                        '[TabNotes] Falha ao carregar estado.',
                        error
                    );

                    sendResponse({
                        ok: false,
                        error:
                            String(
                                error
                            ),
                    });
                });

            return true;
        }

        // ========================================================
        // SAVE
        // ========================================================

        if (
            message?.type ===
            MESSAGE.SAVE_STATE
        ) {
            const state =
                message.state;

            if (
                !state ||
                !Array.isArray(
                    state.notes
                )
            ) {
                sendResponse({
                    ok: false,
                    error:
                        'INVALID_STATE',
                });

                return false;
            }

            /*
             * A visibilidade continua efêmera. No próximo carregamento,
             * o content script deriva o estado visual pela existência
             * ou não de notas salvas para a aba.
             */
            const stateToSave = {
                ...state,
                visible: false,
            };

            storage
                .set({
                    [key]:
                        stateToSave,
                })
                .then(() => {
                    sendResponse({
                        ok: true,
                        incognito,
                    });
                })
                .catch(error => {
                    console.error(
                        '[TabNotes] Falha ao salvar estado.',
                        error
                    );

                    sendResponse({
                        ok: false,
                        error:
                            String(
                                error
                            ),
                    });
                });

            return true;
        }

        return false;
    }
);

/*
 * Quando uma aba é fechada, removemos as possíveis
 * chaves regular/incognito.
 *
 * Isso também impede que um tabId reutilizado pelo Chrome
 * receba notas pertencentes a uma aba antiga.
 */
chrome.tabs.onRemoved.addListener(
    tabId => {
        const regularKey =
            storageKey(
                tabId,
                false
            );

        const incognitoKey =
            storageKey(
                tabId,
                true
            );

        Promise.allSettled([
            chrome.storage.local.remove(
                regularKey
            ),

            chrome.storage.session.remove(
                incognitoKey
            ),
        ]).then(results => {
            for (
                const result of results
            ) {
                if (
                    result.status ===
                    'rejected'
                ) {
                    console.error(
                        '[TabNotes] Falha ao limpar estado da aba.',
                        result.reason
                    );
                }
            }
        });
    }
);