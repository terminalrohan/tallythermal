
// 📁 File: src/App.jsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Controls from './Controls'; // Assuming Controls.jsx exists and handles settings
import PrintPreview from './PrintPreview'; // Assuming PrintPreview.jsx exists
import parseTallyXML from './parseTallyXML'; // Assuming parseTallyXML.js exists
import generateEscPosCommands from './generateEscPosCommands'; // IMPORT THE EXTERNAL ESC/POS GENERATOR

export default function App() {
  const [xmlData, setXmlData] = useState(null);
  const [status, setStatus] = useState('Ready. Please select Tally XML files.');
  const [copyCount, setCopyCount] = useState(1);
  const [printQueue, setPrintQueue] = useState([]); // Array of {id, fileName, xmlData, status}
  const [currentPrintingId, setCurrentPrintingId] = useState(null);
  const [settings, setSettings] = useState(() => {
    // Initialize settings from localStorage or defaults
    try {
      const saved = localStorage.getItem('tallyPrintSettings');
      return saved ? JSON.parse(saved) : {
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: 1.4,
        headerAlignment: 'center',
        logoUrl: '', // Ensure logoUrl is part of settings
        lineSeparator: '-',
        zoom: 1.0,
        sectionStyles: {
          orderInfo: { labelBold: false, valueBold: true }
        }
      };
    } catch (e) {
      console.error("Failed to parse settings from localStorage, using defaults:", e);
      return {
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: 1.4,
        headerAlignment: 'center',
        logoUrl: '',
        lineSeparator: '-',
        zoom: 1.0,
        sectionStyles: {
          orderInfo: { labelBold: false, valueBold: true }
        }
      };
    }
  });
  const [isDragging, setIsDragging] = useState(false); // State for drag-and-drop visual feedback
  const [showCosmeticControls, setShowCosmeticControls] = useState(false); // State for toggle

  const printRef = useRef(null); // Ref for PrintPreview component
  const fileInputRef = useRef(null);

  // Load copyCount from localStorage (separately from settings if needed)
  useEffect(() => {
    const saved = localStorage.getItem('tallyPrintSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCopyCount(parsed.copyCount ? Math.max(1, Math.min(9, parseInt(parsed.copyCount) || 1)) : 1);
      } catch (e) {
        console.error("Failed to parse copyCount from localStorage, using default:", e);
      }
    }
  }, []);

  // Save settings (including copyCount) to localStorage whenever settings or copyCount changes
  useEffect(() => {
    localStorage.setItem('tallyPrintSettings', JSON.stringify({ ...settings, copyCount }));
  }, [settings, copyCount]);

  // Generate unique ID for queue items
  const generateId = () => Date.now() + Math.random();

  // Add files to print queue
  const addToQueue = (files) => {
    const newItems = files.map(({ fileName, xmlData }) => ({
      id: generateId(),
      fileName,
      xmlData,
      status: 'pending' // pending, printing, completed
    }));
    setPrintQueue(prev => [...prev, ...newItems]);
    
    // Set preview to first item if none selected
    if (!xmlData && newItems.length > 0) {
      setXmlData(newItems[0].xmlData);
    }
  };

  // Remove item from queue with animation
  const removeFromQueue = (id) => {
    setPrintQueue(prev => prev.map(item => 
      item.id === id ? { ...item, status: 'completed' } : item
    ));
    
    // Remove after animation
    setTimeout(() => {
      setPrintQueue(prev => {
        const filtered = prev.filter(item => item.id !== id);
        // Update preview if removed item was being previewed
        if (filtered.length > 0 && xmlData && prev.find(item => item.id === id && item.xmlData === xmlData)) {
          setXmlData(filtered[0].xmlData);
        } else if (filtered.length === 0) {
          setXmlData(null);
        }
        return filtered;
      });
    }, 500);
  };

  // WebUSB Print Handler for batch printing
  const handleWebUSBPrint = useCallback(async () => {
    const pendingItems = printQueue.filter(item => item.status === 'pending');
    
    if (pendingItems.length === 0) {
      alert("Nothing to print. Please load XML files first.");
      return;
    }
    
    if (!('usb' in navigator)) {
      alert("WebUSB not supported in this browser.");
      return;
    }

    let device;
    try {
      setStatus("[🖨] Requesting USB device...");
      
      const filters = [
        { vendorId: 0x0483, productId: 0x5720 }, // HGS 030 Printer
      ];
      device = await navigator.usb.requestDevice({ filters: filters });

      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);

      const endpoint = device.configuration.interfaces[0].alternate.endpoints.find(e => e.direction === 'out');
      if (!endpoint) throw new Error("No OUT endpoint found on the device.");

      // Print each item in queue
      for (const item of pendingItems) {
        setCurrentPrintingId(item.id);
        setPrintQueue(prev => prev.map(queueItem => 
          queueItem.id === item.id ? { ...queueItem, status: 'printing' } : queueItem
        ));

        setStatus(`[🖨] Generating print commands for ${item.fileName}...`);
        const escPosCommands = await generateEscPosCommands(item.xmlData, settings);

        for (let i = 0; i < copyCount; i++) {
          setStatus(`[🖨] Printing ${item.fileName} - copy ${i + 1} of ${copyCount}...`);
          await device.transferOut(endpoint.endpointNumber, escPosCommands);
        }

        // Remove item from queue after successful print
        removeFromQueue(item.id);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between prints
      }

      setCurrentPrintingId(null);
      setStatus(`✅ Printed ${pendingItems.length} documents successfully.`);
      alert(`✅ Printed ${pendingItems.length} documents successfully.`);
    } catch (err) {
      console.error("[❌ WebUSB Error] ", err);
      setCurrentPrintingId(null);
      setPrintQueue(prev => prev.map(item => 
        item.status === 'printing' ? { ...item, status: 'pending' } : item
      ));
      
      let errorMessage = "Printing failed: " + err.message;
      if (err.name === 'NotFoundError') {
        errorMessage = "Printing failed: No printer selected or found. Please ensure it's connected and select it from the prompt.";
      } else if (err.name === 'SecurityError' && err.message.includes('Access denied')) {
        errorMessage = "Printing failed: Access denied to USB device. Please ensure no other application is using it and grant browser permission.";
      } else if (err.message.includes('No OUT endpoint found')) {
        errorMessage = "Printing failed: Printer not configured correctly or not supported. No OUT endpoint found.";
      }
      setStatus(errorMessage);
      alert(errorMessage);
    } finally {
      if (device && device.opened) {
        try {
          await device.releaseInterface(0);
          await device.close();
          console.log("[🖨] USB device closed.");
        } catch (closeErr) {
          console.error("Error closing USB device:", closeErr);
        }
      }
    }
  }, [copyCount, printQueue, settings]);

  // Ctrl+P or Cmd+P shortcut for printing
  useEffect(() => {
    const handleKeydown = (e) => {
      const isMac = navigator.platform.includes('Mac');
      const isPrintShortcut = (isMac && e.metaKey) || (!isMac && e.ctrlKey);
      if (isPrintShortcut && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handleWebUSBPrint();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [handleWebUSBPrint]);

  // Process multiple files
  const processFiles = (files) => {
    const fileArray = Array.from(files);
    const xmlFiles = fileArray.filter(file => 
      file.type === 'application/xml' || file.name.toLowerCase().endsWith('.xml')
    );

    if (xmlFiles.length === 0) {
      setStatus('Please drop valid XML files (.xml).');
      return;
    }

    setStatus(`Processing ${xmlFiles.length} files...`);
    const processedFiles = [];
    let completed = 0;

    xmlFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        if (!content || content.length === 0) {
          console.error(`File ${file.name} is empty or unreadable.`);
          completed++;
          return;
        }
        
        const data = parseTallyXML(content);
        if (data) {
          processedFiles.push({ fileName: file.name, xmlData: data });
        } else {
          console.error(`Failed to parse ${file.name}`);
        }
        
        completed++;
        if (completed === xmlFiles.length) {
          if (processedFiles.length > 0) {
            addToQueue(processedFiles);
            setStatus(`Successfully loaded ${processedFiles.length} files. Ready to print.`);
          } else {
            setStatus('No valid XML files could be processed.');
          }
        }
      };
      reader.onerror = () => {
        console.error(`Error reading file: ${file.name}`);
        completed++;
      };
      reader.readAsText(file);
    });
  };

  // File Input Handler
  const handleFileChange = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  };

  // Drag and Drop Logic
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }, []);

  // Clear all completed items
  const clearCompleted = () => {
    setPrintQueue(prev => prev.filter(item => item.status !== 'completed'));
  };

  // Clear entire queue
  const clearQueue = () => {
    setPrintQueue([]);
    setXmlData(null);
  };

  // Select item for preview
  const selectForPreview = (item) => {
    setXmlData(item.xmlData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
        <header className="text-center mb-8 lg:mb-12">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Tally Thermal Print App
            </h1>
          </div>
          <p className="text-base lg:text-lg text-gray-600 font-medium">Upload multiple Sales Order XMLs and batch print with ease</p>
        </header>

        {/* Container 1: Modern Drag and Drop + File Upload */}
        <div className="bg-white/70 backdrop-blur-sm p-4 sm:p-6 lg:p-8 rounded-2xl shadow-xl border border-white/20 mb-6 lg:mb-8 hover:shadow-2xl transition-all duration-300">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              mb-6 lg:mb-8 p-6 sm:p-8 lg:p-12 border-2 border-dashed rounded-2xl text-center
              transition-all duration-300 ease-in-out relative overflow-hidden
              ${isDragging 
                ? 'border-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-inner scale-[1.02]' 
                : 'border-gray-300 bg-gradient-to-r from-gray-50 to-slate-50 hover:border-gray-400 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50'
              }
            `}
          >
            <div className="relative z-10">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 lg:mb-4 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-lg sm:text-xl font-bold text-gray-700 mb-2">
                Drag & Drop your XML files here
              </p>
              <p className="text-sm text-gray-500 font-medium">
                Supports multiple files • XML format only
              </p>
            </div>
          </div>

          <div className="text-center">
            <input 
              type="file" 
              accept=".xml" 
              multiple 
              onChange={handleFileChange} 
              ref={fileInputRef} 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current.click()} 
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-6 sm:px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="hidden sm:inline">Upload XML Files</span>
                <span className="sm:hidden">Upload Files</span>
              </span>
            </button>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
              <p className="text-gray-700 font-medium">{status}</p>
            </div>
          </div>
        </div>

        {/* Modern Print Queue */}
        {printQueue.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm p-4 sm:p-6 lg:p-8 rounded-2xl shadow-xl border border-white/20 mb-6 lg:mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Print Queue</h2>
                <span className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
                  {printQueue.length} items
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={clearCompleted}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap"
                >
                  Clear Completed
                </button>
                <button 
                  onClick={clearQueue}
                  className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap"
                >
                  Clear All
                </button>
              </div>
            </div>
            
            <div className="max-h-60 sm:max-h-80 overflow-y-auto space-y-3 custom-scrollbar">
              {printQueue.map((item, index) => (
                <div
                  key={item.id}
                  className={`
                    flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-xl border-2 transition-all duration-500 cursor-pointer gap-3 sm:gap-0
                    ${item.status === 'pending' ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100' : ''}
                    ${item.status === 'printing' ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 animate-pulse shadow-md' : ''}
                    ${item.status === 'completed' ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 opacity-60 transform scale-95' : ''}
                    ${xmlData === item.xmlData ? 'ring-2 ring-blue-400 shadow-lg transform scale-[1.02]' : ''}
                    hover:shadow-md group
                  `}
                  onClick={() => selectForPreview(item)}
                >
                  <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                    <div className="w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-500 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors block truncate">{item.fileName}</span>
                      {item.xmlData.order?.number && (
                        <div className="text-sm text-gray-600 font-medium">Order: {item.xmlData.order.number}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end sm:justify-start space-x-3 flex-shrink-0">
                    {item.status === 'pending' && (
                      <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
                        Pending
                      </span>
                    )}
                    {item.status === 'printing' && (
                      <span className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
                        Printing...
                      </span>
                    )}
                    {item.status === 'completed' && (
                      <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
                        ✓ Completed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modern Grid for Controls (Left) and Preview (Right) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
          {/* Container 3: Modern Print Controls & Cosmetic Controls */}
          <div className="bg-white/80 backdrop-blur-sm p-4 sm:p-6 lg:p-8 rounded-2xl shadow-xl border border-white/20">
            {/* Modern Print Controls */}
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Print Controls</h2>
            </div>
            
            <div className="mb-6 lg:mb-8">
              <label className="block font-semibold text-gray-700 mb-3">Number of Copies</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <input
                  type="number"
                  min="1"
                  max="9"
                  value={copyCount}
                  onChange={(e) =>
                    setCopyCount(Math.max(1, Math.min(9, parseInt(e.target.value) || 1)))
                  }
                  className="w-20 px-4 py-3 border-2 border-gray-200 rounded-xl shadow-sm focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all duration-200 font-semibold text-center"
                />
                <div className="flex-1 bg-gray-100 rounded-lg p-2 w-full sm:w-auto">
                  <div className="text-sm text-gray-600">Range: 1-9 copies</div>
                </div>
              </div>

              <button
                onClick={handleWebUSBPrint}
                disabled={printQueue.filter(item => item.status === 'pending').length === 0}
                className="mt-4 sm:mt-6 w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 sm:py-4 px-4 sm:px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span className="text-sm sm:text-base">
                    {printQueue.filter(item => item.status === 'pending').length > 0 
                      ? `Print Queue (${printQueue.filter(item => item.status === 'pending').length} items)`
                      : 'No Items to Print'
                    }
                  </span>
                </span>
              </button>
              <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700 text-center font-medium">⌨️ Shortcut: Ctrl + P / Cmd + P</p>
              </div>
            </div>

            {/* Modern Cosmetic Controls (Toggleable) */}
            <div className="border-t border-gray-200 pt-6">
              <button
                onClick={() => setShowCosmeticControls(!showCosmeticControls)}
                className="w-full flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-slate-50 hover:from-gray-100 hover:to-slate-100 rounded-xl border border-gray-200 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v1m0 0V5a2 2 0 012-2h6a2 2 0 012 2v1M7 7h10v4H7z" />
                    </svg>
                  </div>
                  <span className="text-lg sm:text-xl font-bold text-gray-800">Cosmetic Controls</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 font-medium">
                    {showCosmeticControls ? 'Hide' : 'Show'}
                  </span>
                  <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${showCosmeticControls ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              {showCosmeticControls && (
                <div className="mt-4 p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <Controls settings={settings} onSettingsChange={setSettings} />
                </div>
              )}
            </div>
          </div>

          {/* Container 2: Modern Print Preview */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
            <PrintPreview data={xmlData} settings={settings} printRef={printRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
