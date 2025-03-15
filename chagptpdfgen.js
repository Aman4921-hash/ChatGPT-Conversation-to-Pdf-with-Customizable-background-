// ==UserScript==
// @name         ChatGPT.com Ultimate PDF Converter v7.4
// @namespace    http://tampermonkey.net/
// @version      3.3
// @description  Export ChatGPT conversations as multi-page PDFs with complete options (orientation, dark mode, margin, scale, filename, customizable background style with modern light palette & custom hex colors, extra color addition), animated UI feedback, smart text wrapping with intelligent content width calculation, and header/footer. Options panel pops up centered.
// @author       
// @match        https://chatgpt.com/*
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.9.3/html2pdf.bundle.min.js
// ==/UserScript==

(function() {
    'use strict';

    /***********************
     *  PERSISTENT SETTINGS
     ***********************/
    const STORAGE_KEY = 'chatgptPdfSettings';
    const defaultSettings = {
        orientation: 'portrait',           // "portrait" or "landscape"
        darkMode: false,                   // PDF dark mode toggle
        margin: 0.5,                       // in inches
        scale: 2,                          // html2canvas scale factor
        filename: 'chatgpt-conversation.pdf',
        backgroundStyle: 'default',        // "default", "modern", "custom"
        selectedModernColor: '#FFD6FF',    // Default preset modern light color
        customBgColor: '#e0f7fa',           // Used if backgroundStyle==="custom"
        additionalModernColors: []         // Extra colors added by user
    };

    function loadSettings() {
        try {
            return Object.assign({}, defaultSettings, JSON.parse(localStorage.getItem(STORAGE_KEY)));
        } catch (e) {
            return defaultSettings;
        }
    }

    function saveSettings(s) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    }

    let settings = loadSettings();

    /***********************
     *  BUILD TOGGLE BUTTON (Right-Middle Edge)
     ***********************/
    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'PDF Options';
    Object.assign(toggleButton.style, {
        position: 'fixed',
        top: '50%',
        right: '0',
        transform: 'translateY(-50%)',
        backgroundColor: '#10a37f',
        color: '#fff',
        border: 'none',
        padding: '10px 15px',
        cursor: 'pointer',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        borderRadius: '5px 0 0 5px',
        zIndex: 1000
    });
    document.body.appendChild(toggleButton);

    /***********************
     *  BUILD OPTIONS PANEL (Centered Pop-up)
     ***********************/
    const panel = document.createElement('div');
    panel.id = 'pdfOptionsPanel';
    Object.assign(panel.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '340px',
        maxHeight: '90vh',
        overflowY: 'auto',
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        borderRadius: '5px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
        padding: '15px',
        zIndex: 1100,
        display: 'none',
        fontFamily: 'Arial, sans-serif',
        color: '#333'
    });
    panel.innerHTML = `
        <div style="margin-bottom:10px; font-weight:bold; text-align:center;">PDF Settings</div>
        
        <!-- Orientation -->
        <div style="margin-bottom:8px;">
            <label style="font-size:13px;">
                Orientation 
                <span style="cursor:help; color:#888;" title="Set PDF orientation: Portrait (vertical) or Landscape (horizontal).">?</span>:
            </label><br>
            <label style="font-size:12px;">
                <input type="radio" name="orientation" value="portrait"> Portrait
            </label>
            <label style="font-size:12px; margin-left:10px;">
                <input type="radio" name="orientation" value="landscape"> Landscape
            </label>
        </div>
        
        <!-- Dark Mode -->
        <div style="margin-bottom:8px;">
            <label style="font-size:13px;">
                <input type="checkbox" id="darkModeToggle"> Dark Mode 
                <span style="cursor:help; color:#888;" title="Enable dark mode for PDF (overrides background style).">?</span>
            </label>
        </div>
        
        <!-- Margin -->
        <div style="margin-bottom:8px;">
            <label style="font-size:13px;">
                Margin (inches)
                <span style="cursor:help; color:#888;" title="Set the PDF margin in inches.">?</span>:
            </label><br>
            <input type="number" id="pdfMargin" value="${settings.margin}" step="0.1" style="width:100%; padding:3px; font-size:13px;">
        </div>
        
        <!-- Scale Factor -->
        <div style="margin-bottom:8px;">
            <label style="font-size:13px;">
                Scale Factor
                <span style="cursor:help; color:#888;" title="Higher values yield better quality but slower processing.">?</span>:
            </label><br>
            <input type="number" id="pdfScale" value="${settings.scale}" step="0.1" style="width:100%; padding:3px; font-size:13px;">
        </div>
        
        <!-- Filename -->
        <div style="margin-bottom:8px;">
            <label style="font-size:13px;">
                File Name
                <span style="cursor:help; color:#888;" title="Name of the downloaded PDF file.">?</span>:
            </label><br>
            <input type="text" id="pdfFilename" value="${settings.filename}" style="width:100%; padding:3px; font-size:13px;">
        </div>
        
        <!-- Background Style -->
        <div style="margin-bottom:8px;">
            <label style="font-size:13px;">
                Background Style
                <span style="cursor:help; color:#888;" title="Choose the PDF background when not in dark mode. 'Website Default' uses the site UI, 'Modern Light' offers a pastel palette, 'Custom' lets you pick any color.">?</span>:
            </label><br>
            <select id="backgroundStyle" style="width:100%; padding:3px; font-size:13px;">
                <option value="default">Website Default</option>
                <option value="modern">Modern Light</option>
                <option value="custom">Custom</option>
            </select>
        </div>
        
        <!-- Modern Light Color Palette -->
        <div id="modernColorContainer" style="margin-bottom:8px; display:none;">
            <label style="font-size:13px;">Modern Light Colors:</label>
            <div id="colorPalette" style="display: flex; flex-wrap: wrap; gap: 5px; margin-top:5px;"></div>
            <div style="margin-top:5px;">
                <input type="text" id="newColorInput" placeholder="#RRGGBB" style="width:60%; padding:3px; font-size:13px;">
                <button id="addColorBtn" style="padding:3px 5px; font-size:13px; margin-left:5px;">Add Color</button>
            </div>
        </div>
        
        <!-- Custom Background Color Picker -->
        <div id="customBgColorContainer" style="margin-bottom:8px; display:none;">
            <label style="font-size:13px;">Custom Background Color:</label><br>
            <input type="color" id="customBgColor" value="${settings.customBgColor}" style="width:100%; padding:3px; font-size:13px;">
        </div>
        
        <!-- Close Panel Button -->
        <div style="text-align:center; margin-top:10px;">
            <button id="closePanelBtn" style="background:#10a37f; color:#fff; border:none; padding:8px 12px; border-radius:3px; cursor:pointer; font-size:13px;">
                Close
            </button>
        </div>
        
        <!-- Generate PDF Button -->
        <div style="text-align: right; margin-top:10px;">
            <button id="generatePdfBtn" style="background:#10a37f; color:#fff; border:none; padding:8px 12px; border-radius:3px; cursor:pointer; font-size:13px;">
                Generate PDF
            </button>
        </div>
    `;
    document.body.appendChild(panel);

    // Set orientation radio buttons.
    document.querySelectorAll('input[name="orientation"]').forEach(input => {
        if (input.value === settings.orientation) {
            input.checked = true;
        }
    });
    // Set dark mode toggle.
    document.getElementById('darkModeToggle').checked = settings.darkMode;
    // Set background style select.
    document.getElementById('backgroundStyle').value = settings.backgroundStyle;
    function updateBgStyleUI() {
        const style = document.getElementById('backgroundStyle').value;
        settings.backgroundStyle = style;
        saveSettings(settings);
        document.getElementById('modernColorContainer').style.display = (style === 'modern') ? 'block' : 'none';
        document.getElementById('customBgColorContainer').style.display = (style === 'custom') ? 'block' : 'none';
    }
    updateBgStyleUI();
    document.getElementById('backgroundStyle').addEventListener('change', updateBgStyleUI);

    // Attach listeners for remaining inputs.
    function attachListener(id, key, parser = v => v) {
        document.getElementById(id).addEventListener('change', function() {
            settings[key] = parser(this.type === 'checkbox' ? this.checked : this.value);
            saveSettings(settings);
        });
    }
    attachListener('pdfMargin', 'margin', parseFloat);
    attachListener('pdfScale', 'scale', parseFloat);
    attachListener('pdfFilename', 'filename');
    attachListener('customBgColor', 'customBgColor');
    document.querySelectorAll('input[name="orientation"]').forEach(input => {
        input.addEventListener('change', function() {
            settings.orientation = document.querySelector('input[name="orientation"]:checked').value;
            saveSettings(settings);
        });
    });
    attachListener('darkModeToggle', 'darkMode', v => v);

    /***********************
     *  MODERN COLOR PALETTE & ADDITIONAL COLORS
     ***********************/
    const colorPalette = document.getElementById('colorPalette');
    const defaultModernColors = ["#FFD6FF", "#FFE5EC", "#E2EAFC", "#E9F5DB", "#A1CCA5", "#FFDEB4", "#FFC8A2", "#D8B4F8", "#A8DADC", "#B5EAD7"];
    let additionalColors = settings.additionalModernColors || [];
    function getAllModernColors() {
        return defaultModernColors.concat(additionalColors);
    }
    function renderPalette() {
        colorPalette.innerHTML = '';
        getAllModernColors().forEach(color => {
            const box = document.createElement('div');
            Object.assign(box.style, {
                width: '30px',
                height: '30px',
                backgroundColor: color,
                borderRadius: '5px',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s'
            });
            box.addEventListener('mouseover', () => {
                box.style.transform = 'scale(1.1)';
                box.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';
            });
            box.addEventListener('mouseout', () => {
                box.style.transform = 'scale(1)';
                box.style.boxShadow = 'none';
            });
            box.addEventListener('click', () => {
                settings.selectedModernColor = color;
                saveSettings(settings);
                renderPalette();
            });
            if (color === settings.selectedModernColor) {
                box.style.border = '3px solid #10a37f';
            }
            colorPalette.appendChild(box);
        });
    }
    renderPalette();
    document.getElementById('addColorBtn').addEventListener('click', () => {
        const newColor = document.getElementById('newColorInput').value.trim();
        if (/^#([0-9A-Fa-f]{6})$/.test(newColor)) {
            additionalColors.push(newColor);
            settings.additionalModernColors = additionalColors;
            saveSettings(settings);
            renderPalette();
            document.getElementById('newColorInput').value = '';
        } else {
            alert("Enter a valid hex color (e.g. #AABBCC).");
        }
    });

    /***********************
     *  PANEL TOGGLE LOGIC
     ***********************/
    // When toggle button is clicked, show the panel.
    toggleButton.addEventListener('click', () => {
        panel.style.display = 'block';
    });
    // Close panel button.
    document.getElementById('closePanelBtn').addEventListener('click', () => {
        panel.style.display = 'none';
    });

    /***********************
     *  PDF GENERATION WITH INTELLIGENT TEXT WRAPPING
     ***********************/
    async function generatePdf() {
        const btn = document.getElementById('generatePdfBtn');
        btn.textContent = 'Generating...';
        btn.style.backgroundColor = '#FF9800';
        btn.style.cursor = 'not-allowed';
        btn.disabled = true;
        
        // Locate conversation container.
        const container = document.querySelector('main') || document.querySelector('.conversation') || document.querySelector('#conversation') || document.querySelector('section');
        if (!container) {
            alert("Conversation container not found!");
            resetGenerateButton();
            return;
        }
        const clone = container.cloneNode(true);
        
        // Calculate available content width (in pixels) based on page size and margins.
        let contentWidthInInches;
        if (settings.orientation === 'portrait') {
            contentWidthInInches = 8.5 - 2 * settings.margin;
        } else {
            contentWidthInInches = 11 - 2 * settings.margin;
        }
        // Assume 96 pixels per inch.
        const contentWidthInPx = contentWidthInInches * 96;
        clone.style.width = contentWidthInPx + 'px';
        
        // Ensure complete words remain intact.
        clone.style.whiteSpace = 'pre-wrap';
        clone.style.wordWrap = 'break-word';
        clone.style.overflowWrap = 'normal';
        clone.style.wordBreak = 'normal';
        clone.style.hyphens = 'none';
        
        // Apply background styling.
        if (settings.darkMode) {
            clone.style.backgroundColor = '#2d2d2d';
            clone.style.color = '#f1f1f1';
        } else {
            if (settings.backgroundStyle === "modern") {
                clone.style.backgroundColor = settings.selectedModernColor;
            } else if (settings.backgroundStyle === "custom") {
                clone.style.backgroundColor = settings.customBgColor;
            } else {
                const origBg = window.getComputedStyle(container).backgroundColor;
                clone.style.backgroundColor = origBg;
            }
            clone.style.color = '#333';
        }
        
        // Inject CSS to avoid breaking paragraphs mid-word.
        const styleTag = document.createElement('style');
        styleTag.innerHTML = `
            p, h1, h2, h3, h4, h5, h6, li, blockquote {
                page-break-inside: avoid;
                break-inside: avoid;
            }
        `;
        clone.insertBefore(styleTag, clone.firstChild);
        
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'fixed';
        tempContainer.style.top = '-9999px';
        tempContainer.appendChild(clone);
        document.body.appendChild(tempContainer);
        
        const opt = {
            margin: settings.margin,
            filename: settings.filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: settings.scale, useCORS: true, scrollY: -window.scrollY },
            jsPDF: { unit: 'in', format: 'letter', orientation: settings.orientation }
        };
        
        try {
            const pdfGen = html2pdf().set(opt).from(clone);
            await pdfGen.toPdf();
            const pdf = await pdfGen.get('pdf');
            const pageCount = pdf.internal.getNumberOfPages();
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            pdf.setFontSize(10);
            for (let i = 1; i <= pageCount; i++) {
                pdf.setPage(i);
                pdf.text("ChatGPT Conversation", pageWidth / 2, 0.5 * 72, { align: 'center' });
                pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 0.5 * 72, { align: 'center' });
            }
            pdf.save(settings.filename);
        } catch (e) {
            alert("An error occurred during PDF generation.");
            console.error(e);
        } finally {
            tempContainer.remove();
            resetGenerateButton();
        }
    }

    function resetGenerateButton() {
        const btn = document.getElementById('generatePdfBtn');
        btn.textContent = 'Generate PDF';
        btn.style.backgroundColor = '#10a37f';
        btn.style.cursor = 'pointer';
        btn.disabled = false;
    }

    document.getElementById('generatePdfBtn').addEventListener('click', generatePdf);

})();
