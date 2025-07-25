import React, { useState, useEffect, useCallback, useRef } from 'react';

// Main App component
const App = () => {
    // State to store the input data from the textarea
    const [csvInput, setCsvInput] = useState('');
    // State to store the processed results (Markdown blocks)
    const [results, setResults] = useState([]);
    // State for user messages (e.g., "Copied!")
    const [message, setMessage] = useState('');
    // State for audit results
    const [auditResults, setAuditResults] = useState([]);
    // Ref for the file input to clear it programmatically (now unused for file upload, kept for clearing textarea)
    const fileInputRef = useRef(null);

    // New state for search functionality
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredResults, setFilteredResults] = useState([]);


    // Refs to store intermediate data for audit without causing re-renders
    const parsedRowsRef = useRef([]);
    const groupedBlocksMapRef = useRef(new Map());
    const finalBlockIdentifiersRef = useRef(new Set()); // Stores all identifiers present in final blocks

    // Function to process a single row of data, returning structured data for grouping
    const processRow = useCallback((rowData) => {
        let { link, copy, date, customTopic } = rowData; // Use let to reassign link

        // PRE-PROCESSING: Remove ?utm_campaign and anything after it from the link
        const utmIndex = link.indexOf('?utm_campaign');
        if (utmIndex !== -1) {
            link = link.substring(0, utmIndex);
            console.log(`Link cleaned: Removed UTM parameters. New link: ${link}`);
        }


        // 1. Detect platform and extract identifier
        let identifier = '';
        let identifierOperator = '';
        let platform = 'Desconocida';
        let abbreviatedPlatform = '??';

        if (link.includes('linkedin.com')) {
            // Si es un enlace de LinkedIn, ignorar y devolver null
            console.warn(`Ignorando enlace de LinkedIn: ${link}`);
            return null; // Return null to indicate this row should be ignored
        } else if (link.includes('facebook.com')) {
            const match = link.match(/_(\d+)$/);
            if (match) {
                identifier = match[1];
                identifierOperator = 'engagingWithGuid:';
            }
            platform = 'Facebook';
            abbreviatedPlatform = 'FB';
        } else if (link.includes('tiktok.com')) {
            const match = link.match(/\/video\/(\d+)/);
            if (match) {
                identifier = match[1];
                identifierOperator = 'engagingWithGuid:';
            }
            platform = 'TikTok';
            abbreviatedPlatform = 'TK';
        } else if (link.includes('instagram.com')) {
            const match = link.match(/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)(?:\/|\?|$)/);
            if (match && match[1]) {
                identifier = match[1];
                identifierOperator = 'url:';
            }
            platform = 'Instagram';
            abbreviatedPlatform = 'IG';
        } else {
            console.warn(`Plataforma desconocida para el enlace: ${link}`);
            identifier = ''; // No valid identifier for unknown platform
            identifierOperator = 'unknown:';
            platform = 'Desconocida';
            abbreviatedPlatform = '??';
        }

        // 2. Get the first 7 words of the copy for the title operator
        // Sanitize copy: remove both double and single quotes from the content
        const cleanedCopyForTitle = (copy || '').replace(/["']/g, ''); // Ensure copy is a string
        const words = cleanedCopyForTitle.split(/\s+/).filter(word => word.length > 0);
        const titleWords = words.slice(0, 7).join(' ');
        let titleOperator = '';

        // Omit title operator if the generated title has less than 4 words
        if (titleWords.split(/\s+/).filter(word => word.length > 0).length >= 4) {
            titleOperator = `title:"${titleWords}"`;
        } else {
            console.log(`Omitiendo title operator para copy: "${copy}" (menos de 4 palabras en el título generado)`);
        }

        // 3. Format the date to dd/mm/yy (two-digit year)
        let formattedDate = '';
        let parsedDate = null;

        // Try parsing DD-MM-YY first (new format)
        const datePartsDashYY = date.split('-');
        if (datePartsDashYY.length === 3) {
            const day = parseInt(datePartsDashYY[0], 10);
            const month = parseInt(datePartsDashYY[1], 10) - 1; // Month is 0-indexed
            let year = parseInt(datePartsDashYY[2], 10);
            // Convert 2-digit year to 4-digit year (e.g., 24 -> 2024, 99 -> 1999)
            // This heuristic assumes years '00'-'69' are 20xx, and '70'-'99' are 19xx.
            year = (year < 70) ? (2000 + year) : (1900 + year);

            if (!isNaN(day) && !isNaN(month) && !isNaN(year) && day >= 1 && day <= 31 && month >= 0 && month <= 11) {
                parsedDate = new Date(year, month, day);
                // Validate if the parsed date matches the input day/month/year to avoid invalid date creations (e.g., Feb 30)
                if (parsedDate.getDate() !== day || parsedDate.getMonth() !== month || parsedDate.getFullYear() !== year) {
                    parsedDate = null; // Date is invalid, reset
                }
            }
        }

        // If not successfully parsed or invalid, try DD/MM/YYYY or D/M/YYYY
        if (!parsedDate || isNaN(parsedDate.getTime())) {
            const datePartsSlash = date.split('/');
            if (datePartsSlash.length === 3) {
                const day = parseInt(datePartsSlash[0], 10);
                const month = parseInt(datePartsSlash[1], 10) - 1; // Month is 0-indexed
                const year = parseInt(datePartsSlash[2], 10);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year) && day >= 1 && day <= 31 && month >= 0 && month <= 11) {
                    parsedDate = new Date(year, month, day);
                    if (parsedDate.getDate() !== day || parsedDate.getMonth() !== month || parsedDate.getFullYear() !== year) {
                        parsedDate = null;
                    }
                }
            }
        }

        // If still not successfully parsed or invalid, try YYYY-MM-DD
        if (!parsedDate || isNaN(parsedDate.getTime())) {
            const datePartsDash = date.split('-');
            // This is for YYYY-MM-DD, so check if it's 4-digit year first
            if (datePartsDash.length === 3 && datePartsDash[0].length === 4) {
                const year = parseInt(datePartsDash[0], 10);
                const month = parseInt(datePartsDash[1], 10) - 1; // Month is 0-indexed
                const day = parseInt(datePartsDash[2], 10);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year) && day >= 1 && day <= 31 && month >= 0 && month <= 11) {
                    parsedDate = new Date(year, month, day);
                    if (parsedDate.getDate() !== day || parsedDate.getMonth() !== month || parsedDate.getFullYear() !== year) {
                        parsedDate = null;
                    }
                }
            }
        }

        if (parsedDate && !isNaN(parsedDate.getTime())) {
            const day = String(parsedDate.getDate()).padStart(2, '0');
            const month = String(parsedDate.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
            const year = String(parsedDate.getFullYear()).slice(-2);
            formattedDate = `${day}/${month}/${year}`;
        } else {
            // Fallback if date parsing fails, use original string as is
            console.warn(`No se pudo parsear la fecha: "${date}". Usando la cadena original.`);
            formattedDate = date;
        }

        // Determine the topic for the header ("Post" if customTopic is empty)
        const topicForHeader = customTopic && customTopic.trim() !== '' ? customTopic : 'Post';

        // Return structured data for later grouping
        const processedRowData = {
            identifier: identifier, // The raw ID (e.g., "922076793291593" or "DIJk0dJKD4L")
    identifierOperator: identifierOperator, // The operator (e.g., "engagingWithGuid:" or "url:")
    abbreviatedPlatform: abbreviatedPlatform,
    titleWords: titleWords, // Keep original titleWords for grouping key
    titleOperator: titleOperator, // Pass the potentially empty titleOperator
    formattedDate: formattedDate, // e.g., "29/08/24"
        sortableDate: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : 0, // Use timestamp for sorting
                                   topicForHeader: topicForHeader,
                                   originalLink: link
        };
    console.log(`Processed Row: Link: ${link}, Date: ${date} -> Formatted: ${formattedDate}, Sortable: ${processedRowData.sortableDate}`);
    return processedRowData;
    }, []);

    // Helper function to normalize header names for robust matching
    const normalizeHeader = (header) => {
        return header.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); // Remove spaces and non-alphanumeric, convert to uppercase
    };

    // Function to run the audit
    const runAudit = useCallback(() => {
        const auditIssues = [];
        const allParsedRows = parsedRowsRef.current;
        const actualFinalBlockIdentifiers = finalBlockIdentifiersRef.current; // Get the set of identifiers that made it into final blocks

        // Audit: Verify all *expected* identifiers are present in *some* final block.
        for (const row of allParsedRows) {
            // Only audit rows that were successfully processed and have a valid identifier
            if (row && row.identifier && row.identifierOperator && row.identifierOperator !== 'unknown:') {
                const fullIdentifierString = `${row.identifierOperator}${row.identifier}`;
                if (!actualFinalBlockIdentifiers.has(fullIdentifierString)) {
                    auditIssues.push({
                        type: 'Identificador Ausente en Bloque Final',
                        title: row.titleWords, // Use titleWords for context
                        message: `El identificador "${fullIdentifierString}" (del link: ${row.originalLink}) se esperaba en un bloque final pero no se encontró. Esto puede ocurrir si la fila fue ignorada (ej. LinkedIn), o si hubo un problema al generar el bloque.`,
                                     originalLink: row.originalLink
                    });
                }
            }
        }

        if (auditIssues.length === 0) {
            setAuditResults([{ type: 'Éxito', message: '¡Auditoría completada! Todos los identificadores esperados se encontraron en los bloques generados.' }]);
        } else {
            setAuditResults(auditIssues);
        }
    }, []);


    // Effect to process CSV input whenever it changes
    useEffect(() => {
        if (!csvInput) {
            setResults([]);
            setAuditResults([]); // Clear audit results when input changes
            setSearchTerm(''); // Clear search term
            setFilteredResults([]); // Clear filtered results
            return;
        }

        const parsedRows = [];
        let ignoredLinkedInCount = 0;

        // Regex to find URLs and the content until the next URL or end of string
        // This regex looks for:
        // 1. A URL (https?:\/\/[^\s]+)
        // 2. Followed by any characters (.*?) - non-greedy to stop before the date or next URL
        // 3. Followed by a date pattern (\\d{2}-\\d{2}-\\d{2})
        // 4. OR followed by the next URL or end of string, if no date is found
        // The key is to capture the content *up to* the date, or up to the next URL if no date.
        // We'll iterate through the input string, finding each URL and then trying to extract its content and date.

        // This regex attempts to find a URL, then any text, then the date, or the end/next URL.
        // It's tricky to get a single regex to parse all segments reliably if the date isn't *always* at the very end of the segment.
        // Let's try a more iterative approach: find all URLs, then for each URL, look for the date in its subsequent content.

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        let urlsFound = [];
        let urlMatch;
        while ((urlMatch = urlRegex.exec(csvInput)) !== null) {
            urlsFound.push({
                url: urlMatch[0],
                index: urlMatch.index,
                endIndex: urlRegex.lastIndex
            });
        }

        if (urlsFound.length === 0) {
            setMessage('No se encontraron enlaces en el texto. Asegúrate de que los enlaces comiencen con "http://" o "https://".');
            setResults([]);
            setAuditResults([]);
            setSearchTerm('');
            setFilteredResults([]);
            return;
        }

        const datePatternRegex = /(\d{2}-\d{2}-\d{2})$/; // Matches DD-MM-YY at the end of the string

        for (let i = 0; i < urlsFound.length; i++) {
            const currentUrlData = urlsFound[i];
            const nextUrlData = urlsFound[i + 1];

            let segmentEndIndex = nextUrlData ? nextUrlData.index : csvInput.length;
            let contentSegment = csvInput.substring(currentUrlData.endIndex, segmentEndIndex).trim();

            let extractedDate = '';
            let actualCopy = contentSegment;

            // Find the date pattern anywhere in the content segment, but prioritize the one closest to the end
            const allDateMatches = [...actualCopy.matchAll(datePatternRegex)];
            if (allDateMatches.length > 0) {
                const lastDateMatch = allDateMatches[allDateMatches.length - 1]; // Take the last match
                extractedDate = lastDateMatch[1];
                actualCopy = actualCopy.substring(0, lastDateMatch.index).trim();
            } else {
                console.warn(`No se pudo extraer la fecha DD-MM-YY para el enlace: ${currentUrlData.url}. Usando fecha por defecto (01-01-00).`);
                extractedDate = '01-01-00'; // Fallback if date not found
            }

            const rowData = {
                link: currentUrlData.url,
                copy: actualCopy,
                date: extractedDate,
                customTopic: 'Post'
            };

            try {
                const processed = processRow(rowData);
                if (processed !== null) {
                    parsedRows.push(processed);
                } else {
                    ignoredLinkedInCount++;
                }
            } catch (error) {
                console.error(`Error procesando enlace: ${currentUrlData.url}. Error: ${error.message}`, rowData);
            }
        }

        parsedRowsRef.current = parsedRows; // Store parsed rows for audit

        // --- Grouping Logic: Group by formattedDate (date) ---
        // Key: formattedDate, Value: { identifiers: Set, platforms: Set, titleOperators: Set, commonTopic: string, firstFormattedDate: string, sortableDate: number }
        const groupedBlocksMap = new Map();
        const dateOrder = []; // To preserve the order of dates as they appear in the input

        for (const row of parsedRows) {
            const groupKey = row.formattedDate; // Grouping by formattedDate

            if (!groupedBlocksMap.has(groupKey)) {
                groupedBlocksMap.set(groupKey, {
                    identifiers: new Set(),
                                     platforms: new Set(),
                                     titleOperators: new Set(), // New Set to store all valid title operators for this date
                                     commonTopic: row.topicForHeader, // Take topic from first encountered row for this date
                                     firstFormattedDate: row.formattedDate,
                                     sortableDate: row.sortableDate
                });
                dateOrder.push(groupKey); // Add date to order list only once
            }

            const group = groupedBlocksMap.get(groupKey);
            if (row.identifier) {
                group.identifiers.add(`${row.identifierOperator}${row.identifier}`);
            }
            group.platforms.add(row.abbreviatedPlatform);
            if (row.titleOperator) { // Add titleOperator only if it's not empty
                group.titleOperators.add(row.titleOperator);
            }
        }
        groupedBlocksMapRef.current = groupedBlocksMap; // Store grouped map for audit

        // Construct final blocks respecting the order of dates as they appeared in the input
        const finalBlocks = [];
        const tempFinalBlockIdentifiers = new Set(); // Stores all identifiers present in final blocks

        for (const dateKey of dateOrder) { // Iterate using the preserved date order
            const groupData = groupedBlocksMap.get(dateKey);
            if (!groupData) continue; // Should not happen if dateOrder is populated from map keys

            const { identifiers, platforms, commonTopic, titleOperators, firstFormattedDate } = groupData;

            const sortedPlatforms = Array.from(platforms).sort().join('+'); // Sort for consistent output
            const header = `<<<${commonTopic} ${firstFormattedDate} ${sortedPlatforms}>>>`;

            const operatorParts = [];
            if (identifiers.size > 0) {
                operatorParts.push(...Array.from(identifiers));
            }
            if (titleOperators.size > 0) { // Add all collected title operators
                operatorParts.push(...Array.from(titleOperators));
            }

            const combinedOperators = operatorParts.join(' OR ');

            if (combinedOperators) { // Only push a block if there are any operators
                finalBlocks.push(`${header}\n${combinedOperators}`);
                // Add all identifiers from this group to the set of actual final block identifiers for audit
                identifiers.forEach(id => tempFinalBlockIdentifiers.add(id));
            } else {
                console.warn(`Bloque omitido para la fecha "${firstFormattedDate}" porque no se encontraron identificadores ni títulos válidos.`);
            }
        }
        finalBlockIdentifiersRef.current = tempFinalBlockIdentifiers; // Store the set of identifiers for audit

        setResults(finalBlocks);
        setFilteredResults(finalBlocks); // Initialize filtered results with all results


        if (finalBlocks.length === 0 && parsedRows.length > 0 && ignoredLinkedInCount === 0) {
            setMessage('No se pudieron procesar las filas. Verifica el formato de tus datos.');
            setTimeout(() => setMessage(''), 5000);
        } else if (finalBlocks.length > 0) {
            let successMessage = `Se procesaron ${finalBlocks.length} bloques.`;
            if (ignoredLinkedInCount > 0) {
                successMessage += ` Se ignoraron ${ignoredLinkedInCount} enlaces de LinkedIn.`;
            }
            setMessage(successMessage);
            setTimeout(() => setMessage(''), 3000);
        } else if (ignoredLinkedInCount > 0 && finalBlocks.length === 0) {
            setMessage(`Todos los enlaces eran de LinkedIn y fueron ignorados. No se generaron bloques.`);
            setTimeout(() => setMessage(''), 5000);
        }
    }, [csvInput, processRow]);

    // Function to copy text to clipboard
    const copyToClipboard = (text) => {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            setMessage('¡Copiado!');
        } catch (err) {
            setMessage('Error al copiar.');
            console.error('Failed to copy text: ', err);
        }
        document.body.removeChild(textArea);
        setTimeout(() => setMessage(''), 2000); // Clear message after 2 seconds
    };

    // Function to copy all results
    const handleCopyAll = () => {
        // Separar los bloques con "OR" en una nueva línea
        copyToClipboard(results.join('\nOR\n'));
    };

    // Function to download all results as a Markdown file
    const handleDownloadAll = () => {
        // Separar los bloques con "OR" en una nueva línea para el archivo descargado
        const blob = new Blob([results.join('\nOR\n')], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'listening_blocks.md';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setMessage('¡Descargado!');
        setTimeout(() => setMessage(''), 2000);
    };

    // Handle file upload (now effectively a paste from text area)
    const handleFileUpload = (event) => {
        // This function is now unused as file upload is removed.
        // Keeping it as a placeholder if future functionality needs it.
    };

    // Clear input and results
    const handleClearInput = () => {
        setCsvInput('');
        setResults([]);
        setAuditResults([]);
        setSearchTerm('');
        setFilteredResults([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setMessage('Entrada borrada.');
        setTimeout(() => setMessage(''), 2000);
    };

    // Handle search input change
    const handleSearchChange = (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        if (term.trim() === '') {
            setFilteredResults(results);
        } else {
            const searchTermsArray = term.toLowerCase().split(' or ').map(s => s.trim());
            const filtered = results.filter(block => {
                const lowerCaseBlock = block.toLowerCase();
                return searchTermsArray.some(s => lowerCaseBlock.includes(s));
            });
            setFilteredResults(filtered);
        }
    };

    // Effect to re-filter results when the main results change (e.g., after new input)
    useEffect(() => {
        if (searchTerm.trim() !== '') {
            const searchTermsArray = searchTerm.toLowerCase().split(' or ').map(s => s.trim());
            const filtered = results.filter(block => {
                const lowerCaseBlock = block.toLowerCase();
                return searchTermsArray.some(s => lowerCaseBlock.includes(s));
            });
            setFilteredResults(filtered);
        } else {
            setFilteredResults(results);
        }
    }, [results, searchTerm]);


    return (
        <div className="min-h-screen bg-gray-100 p-4 font-sans flex flex-col items-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
        Generador de Bloques de Búsqueda de Listening
        </h1>

        <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md mb-8">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
        1. Ingresa tus datos
        </h2>
        <p className="text-gray-600 mb-4">
        Pega aquí el texto que contiene tus enlaces, copys y fechas concatenados. Cada nueva publicación debe comenzar con una URL (http:// o https://) y terminar con la fecha en formato <code className="bg-gray-200 p-1 rounded text-sm mx-1">DD-MM-YY</code>.
        <br />
        **Nota:** El tema será "Post" por defecto, ya que no se puede extraer del texto. Los bloques se agruparán por fecha y mantendrán el orden de aparición en tu entrada.
        </p>

        <div className="flex justify-end mb-4">
        <button
        onClick={handleClearInput}
        className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition duration-200 ease-in-out shadow-sm"
        >
        Borrar entrada
        </button>
        </div>

        <textarea
        className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
        rows="10"
        placeholder={`Ejemplo:\nhttps://www.facebook.com/352770001124_921437093355563El más que conecta se nos fue de gira por el mejor país de Chile y obvio que se vienen cositas ✨💙👀29-08-24\nhttps://www.instagram.com/reel/DAQV5Qv-H8/Entelín aplicó la técnica Unagi de Ross para prepararse ante cualquier situación en la cocina 🧑‍🍳 Celebremos con maratón de Friends y si no tienes MAX, contrata Planes TV Full+ que incluye MAX sin costo adicional 💙✨ 22-09-24`}
        value={csvInput}
        onChange={(e) => setCsvInput(e.target.value)}
        ></textarea>
        </div>

        <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
        2. Resultados Generados
        </h2>
        {message && (
            <div className="bg-green-100 text-green-800 p-3 rounded-md mb-4 text-center">
            {message}
            </div>
        )}

        <div className="mb-4">
        <input
        type="text"
        placeholder="Buscar en bloques (ej. 909734414525831 OR C_REdQMix6)"
        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={searchTerm}
        onChange={handleSearchChange}
        />
        </div>

        {filteredResults.length > 0 ? (
            <>
            <div className="flex justify-end mb-4 space-x-2">
            <button
            onClick={handleCopyAll}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-200 ease-in-out shadow-sm"
            >
            Copiar Todo (con OR)
            </button>
            <button
            onClick={handleDownloadAll}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition duration-200 ease-in-out shadow-sm"
            >
            Descargar (.md) (con OR)
            </button>
            </div>
            <div className="space-y-6">
            {(searchTerm ? filteredResults : results).map((block, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-md border border-gray-200 relative group">
                <pre className="whitespace-pre-wrap break-words text-sm text-gray-800">
                {block}
                </pre>
                <button
                onClick={() => copyToClipboard(block)}
                className="absolute top-2 right-2 p-2 bg-gray-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out text-gray-600 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
                title="Copiar bloque"
                >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1.5M9 3v2m6-2v2m6 1.5V17m-3-12h-3.586a1 1 0 00-.707.293L7.293 7.293A1 2 0 007 8v3H4a2 2 0 00-2 2v5a2 2 0 002 2h8a2 2 0 002-2v-5a2 2 0 00-2-2h-3V8a2 2 0 00-.586-1.414l-1.707-1.707A2 2 0 009 3z" />
                </svg>
                </button>
                </div>
            ))}
            </div>
            </>
        ) : (
            <p className="text-gray-500 text-center">
            {searchTerm ? "No se encontraron resultados para su búsqueda." : "No hay datos para procesar. Pega tu información o sube un archivo en el área de texto de arriba."}
            </p>
        )}
        </div>

        <div className="w-full max-w-4xl bg-white p-8 rounded-lg shadow-md mt-8">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
        3. Auditoría de Identificadores
        </h2>
        <button
        onClick={runAudit}
        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 transition duration-200 ease-in-out shadow-sm mb-4"
        >
        Auditar Identificadores
        </button>
        {auditResults.length > 0 && (
            <div className="space-y-3">
            {auditResults.map((auditItem, index) => (
                <div key={index} className={`p-3 rounded-md ${auditItem.type === 'Éxito' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                <p className="font-semibold">{auditItem.type}: {auditItem.title || ''}</p>
                <p className="text-sm">{auditItem.message}</p>
                {auditItem.originalLink && <p className="text-xs text-gray-600">Enlace original: {auditItem.originalLink}</p>}
                </div>
            ))}
            </div>
        )}
        </div>
        </div>
        );
};

export default App;
