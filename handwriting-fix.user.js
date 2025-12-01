// ==UserScript==

// @name         Optimized Handwriting Fix

// @namespace    http://tampermonkey.net/

// @version      5.0

// @description  Prevents browser scrolling and refresh during handwriting, and fixes image overlay issues.

// @author       CJeremy

// @match        https://bdfz.xnykcxt.com:5002/*

// @grant        none

// @run-at       document-body

// ==/UserScript==

(function() {

    'use strict';

    // --- CONFIGURATION ---

    const containerSelector = 'body'; // The stable parent element to observe.

    const canvasSelector = '.board.answerCanvas'; // The target element for our fix.

    const fixedAttribute = 'data-tampermonkey-fixed'; // Attribute to mark elements we've already processed.

    /**

     * Applies the touch and scroll fixes to a single canvas element.

     * @param {HTMLElement} element The canvas container element to fix.

     */

    function applyFix(element) {

        if (element.hasAttribute(fixedAttribute)) {

            return;

        }

        console.log('Tampermonkey: Applying fix to new canvas element.', element);

        // 1. Prevent all touch events from triggering browser actions

        element.addEventListener('touchstart', function(event) {

            event.stopPropagation();

        }, { passive: false });

        element.addEventListener('touchmove', function(event) {

            event.preventDefault();

            event.stopPropagation();

        }, { passive: false });

        element.addEventListener('touchend', function(event) {

            event.stopPropagation();

        }, { passive: false });

        // 2. Prevent pull-to-refresh and overscroll

        element.style.overscrollBehaviorY = 'contain';

        element.style.touchAction = 'none';

        // 3. Prevent body scroll when touching canvas

        element.addEventListener('touchstart', function() {

            document.body.style.overflow = 'hidden';

        }, { passive: true });

        element.addEventListener('touchend', function() {

            document.body.style.overflow = '';

        }, { passive: true });

        // 4. Mark as fixed

        element.setAttribute(fixedAttribute, 'true');

    }

    /**

     * Fixes image overlay issues - prevents blocking bottom buttons

     */

    function fixImageOverlay() {

        const observer = new MutationObserver(function(mutations) {

            mutations.forEach(function(mutation) {

                mutation.addedNodes.forEach(function(node) {

                    if (node.nodeType === 1) {

                        const imgContainers = node.querySelectorAll('img[src*="stem"], .stem-image, [class*="image"]');

                        imgContainers.forEach(function(img) {

                            const parent = img.closest('div[style*="position"]');

                            if (parent && !parent.hasAttribute('data-overlay-fixed')) {

                                parent.style.maxHeight = 'calc(100vh - 140px)';

                                parent.style.height = 'auto';

                                parent.style.overflow = 'auto';

                                parent.style.cursor = 'pointer';

                                parent.style.position = parent.style.position || 'relative';

                                parent.style.removeProperty('top');

                                parent.style.removeProperty('bottom');

                                parent.style.removeProperty('left');

                                parent.style.removeProperty('right');

                                parent.style.removeProperty('z-index');

                                parent.style.paddingBottom = parent.style.paddingBottom || '12px';

                                parent.style.boxSizing = 'border-box';

                                parent.style.pointerEvents = 'auto';

                                parent.addEventListener('click', function(e) {

                                    if (e.target === parent || e.target === img) {

                                        parent.style.display = 'none';

                                    }

                                });

                                parent.setAttribute('data-overlay-fixed', 'true');

                            }

                        });

                    }

                });

            });

        });

        observer.observe(document.body, { childList: true, subtree: true });

    }

    /**

     * Searches the page for the main container and starts observing it for changes.

     */

    function initializeObserver() {

        const container = document.querySelector(containerSelector);

        if (!container) {

            // If the container isn't on the page yet, wait a moment and try again.

            // This is a fallback for very slow-loading sites.

            setTimeout(initializeObserver, 500);

            return;

        }

        console.log('Tampermonkey: Found container. Observing for new canvases.', container);

        // Create an observer that will watch for new elements being added inside the container.

        const observer = new MutationObserver(function(mutations) {

            for (const mutation of mutations) {

                // We only care about nodes that have been added to the page.

                if (mutation.addedNodes.length > 0) {

                    // Find all unfixed canvas elements within the added nodes and apply the fix.

                    mutation.addedNodes.forEach(node => {

                        if (node.nodeType === 1) { // Ensure it's an element

                            // Check if the added node itself is a canvas we need to fix

                            if (node.matches(canvasSelector)) {

                                applyFix(node);

                            }

                            // Also check if the added node CONTAINS any canvases (more common)

                            node.querySelectorAll(canvasSelector).forEach(applyFix);

                        }

                    });

                }

            }

        });

        // Start observing the target container for child elements being added or removed.

        observer.observe(container, {

            childList: true, // Watch for direct children being added/removed.

            subtree: true    // Watch for all descendants being added/removed.

        });

        // As a final check, run the fix once on page load for any canvases that

        // might have loaded before the observer was attached.

        document.querySelectorAll(canvasSelector).forEach(applyFix);

    }

    // Start the process.

    initializeObserver();

    fixImageOverlay();

})();
