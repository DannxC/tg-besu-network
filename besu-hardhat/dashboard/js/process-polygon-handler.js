/* eslint-env browser */
/* global setTimeout */
/**
 * ProcessPolygon Handler - Testa a função processPolygon do GeohashConverter
 * 
 * Funções:
 * - Adicionar pontos (click ou manual)
 * - Chamar processPolygon(latitudes[], longitudes[], precision)
 * - Visualizar geohashes retornados
 * - Limpar estado
 */

// Estado do processPolygon
const polygonState = {
  points: [],           // Array de { lat, lon }
  inputMode: 'click',   // 'click' ou 'manual'
  snapPoint: null,      // Ponto de hover/preview (ponto vermelho com snap)
  geohashResults: [],   // Geohashes retornados pelo contrato
  debugInfo: null,      // Debug info (labels, equivalências, etc)
  isProcessing: false,  // Flag para evitar chamadas múltiplas
  initialized: false,   // Flag de inicialização
  snapThreshold: 5      // Distância em pixels para snap nas edges (reduzido de 8 para 5)
};

/**
 * Inicializa o handler
 */
function initProcessPolygonHandler() {
  if (polygonState.initialized) {
    return;
  }
  
  // Setup event listeners
  setupPolygonControls();
  setupCanvasInteraction();
  
  polygonState.initialized = true;
}

/**
 * Setup controles do polígono
 */
function setupPolygonControls() {
  // Input mode select
  const inputModeSelect = document.getElementById('polygon-input-mode-select');
  if (inputModeSelect) {
    inputModeSelect.addEventListener('change', (e) => {
      polygonState.inputMode = e.target.value;
      updatePolygonUI();
      
      if (polygonState.inputMode === 'click') {
        addLogEntry('Modo: Click no canvas para adicionar pontos', 'info');
      } else {
        addLogEntry('Modo: Preencha Lat/Lon manualmente', 'info');
      }
    });
  }
  
  // Botão de adicionar ponto manual
  const addManualBtn = document.getElementById('polygon-add-manual-btn');
  if (addManualBtn) {
    addManualBtn.addEventListener('click', addManualPoint);
  }
  
  // Botão de processar
  const processBtn = document.getElementById('polygon-process-btn');
  if (processBtn) {
    processBtn.addEventListener('click', processPolygon);
  }
  
  // Botão de limpar
  const clearBtn = document.getElementById('polygon-clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearPolygon);
  }
  
  // Botão de toggle (minimizar/maximizar)
  const toggleBtn = document.getElementById('polygon-toggle-btn');
  const polygonControls = document.getElementById('polygon-controls');
  if (toggleBtn && polygonControls) {
    toggleBtn.addEventListener('click', () => {
      polygonControls.classList.toggle('minimized');
      toggleBtn.classList.toggle('rotated');
      toggleBtn.textContent = polygonControls.classList.contains('minimized') ? '▲' : '▼';
    });
  }
}

/**
 * Setup interação com canvas
 */
function setupCanvasInteraction() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  
  // Click para adicionar ponto
  canvas.addEventListener('click', (e) => {
    if (polygonState.inputMode !== 'click') return;
    if (polygonState.isProcessing) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Usar snap point se disponível (ponto vermelho), senão usar posição do mouse
    let lat, lon;
    if (polygonState.snapPoint) {
      lat = polygonState.snapPoint.lat;
      lon = polygonState.snapPoint.lon;
    } else {
      const coords = GeohashUtils.canvasToLatLon(x, y);
      lat = coords.lat;
      lon = coords.lon;
    }
    
    addPoint(lat, lon);
  });
  
  // Mousemove para preview com SNAP
  canvas.addEventListener('mousemove', (e) => {
    if (polygonState.inputMode !== 'click') {
      polygonState.snapPoint = null;
      updateSnapCoords(null, null);
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calcular snap to edge (ponto vermelho)
    const precision = window.appState ? window.appState.precision : 4;
    polygonState.snapPoint = calculateSnapToEdge(x, y, precision);
    
    // Atualizar coordenadas na UI (do ponto vermelho, não do mouse!)
    updateSnapCoords(polygonState.snapPoint.lat, polygonState.snapPoint.lon);
    
    // Re-desenhar grid com preview
    renderPolygonState();
  });
  
  // Mouseleave para limpar preview
  canvas.addEventListener('mouseleave', () => {
    polygonState.snapPoint = null;
    updateSnapCoords(null, null);
    renderPolygonState();
  });
}

/**
 * Adiciona ponto ao polígono
 */
function addPoint(lat, lon) {
  // Verificar se o ponto já existe (evitar vértices duplicados)
  const isDuplicate = polygonState.points.some(point => 
    Math.abs(point.lat - lat) < 0.0001 && Math.abs(point.lon - lon) < 0.0001
  );
  
  if (isDuplicate) {
    addLogEntry('⚠️ Vértice duplicado! Escolha outro ponto.', 'warning');
    showTestStatus('Vértice duplicado ignorado', 'error');
    return;
  }
  
  polygonState.points.push({ lat, lon });
  
  addLogEntry(`Ponto ${polygonState.points.length} adicionado: (${lat.toFixed(4)}, ${lon.toFixed(4)})`, 'success');
  
  updatePolygonUI();
  renderPolygonState();
}

/**
 * Adiciona ponto manual
 */
function addManualPoint() {
  const latInput = document.getElementById('polygon-manual-lat');
  const lonInput = document.getElementById('polygon-manual-lon');
  
  if (!latInput || !lonInput) return;
  
  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);
  
  if (isNaN(lat) || isNaN(lon)) {
    addLogEntry('⚠️ Lat/Lon inválidos', 'error');
    showTestStatus('Lat/Lon inválidos', 'error');
    return;
  }
  
  // Validar limites
  if (lat < -90 || lat > 90) {
    addLogEntry('⚠️ Latitude deve estar entre -90 e 90', 'error');
    showTestStatus('Latitude fora dos limites', 'error');
    return;
  }
  
  if (lon < -180 || lon > 180) {
    addLogEntry('⚠️ Longitude deve estar entre -180 e 180', 'error');
    showTestStatus('Longitude fora dos limites', 'error');
    return;
  }
  
  addPoint(lat, lon);
  
  // Limpar inputs
  latInput.value = '';
  lonInput.value = '';
  latInput.focus();
}

/**
 * Processa o polígono chamando o contrato
 * 
 * IMPORTANTE: O contrato processPolygon() fecha o polígono AUTOMATICAMENTE.
 * Não é necessário repetir o primeiro ponto no final!
 * 
 * Exemplo: Se passar [A, B, C], o contrato desenha: A→B, B→C, C→A
 * (linha 744-746 do GeohashConverter.sol usa módulo para fechar)
 */
async function processPolygon() {
  // Validar mínimo de pontos
  if (polygonState.points.length < 3) {
    addLogEntry('⚠️ Adicione pelo menos 3 pontos para processar', 'error');
    showTestStatus('Mínimo 3 pontos necessários', 'error');
    return;
  }
  
  if (polygonState.isProcessing) {
    addLogEntry('⚠️ Já processando...', 'warning');
    return;
  }
  
  polygonState.isProcessing = true;
  showTestStatus('⏳ Processando polígono...', 'loading');
  
  try {
    // Obter contrato
    const contract = GeohashContract.getContract();
    if (!contract) {
      throw new Error('Contrato não carregado');
    }
    
    // Obter precision atual
    const precision = window.appState.precision;
    
    // Preparar arrays de lat/lon
    const latitudes = [];
    const longitudes = [];
    
    for (const point of polygonState.points) {
      // Converter para int256 com DECIMALS_FACTOR (10^18)
      const latScaled = toInt256WithDecimals(point.lat);
      const lonScaled = toInt256WithDecimals(point.lon);
      
      latitudes.push(latScaled);
      longitudes.push(lonScaled);
    }
    
    // Verificar modo debug
    const labelsDebugCheckbox = document.getElementById('polygon-labels-debug-checkbox');
    const labelsDebug = labelsDebugCheckbox ? labelsDebugCheckbox.checked : false;
    
    const functionLabel = labelsDebug ? 
      '🔍 DEBUG: Labels e classificação (debug=true)' : 
      'processPolygon (bordas + preenchimento)';
    
    addLogEntry(`📡 Chamando ${functionLabel} com ${polygonState.points.length} pontos (precision=${precision})...`, 'info');
    addLogEntry(`ℹ️ Contrato fecha o polígono automaticamente (${polygonState.points.length} → 1)`, 'info');
    console.log(`Chamando processPolygon:`, { latitudes, longitudes, precision, debug: labelsDebug });
    
    // Chamar função do contrato (é uma transação que retorna 5 valores)
    const tx = await contract.processPolygon(latitudes, longitudes, precision, labelsDebug);
    
    addLogEntry('⏳ Aguardando confirmação da transação...', 'info');
    const receipt = await tx.wait();
    
    addLogEntry(`✅ Transação confirmada! Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed.toString()}`, 'success');
    
    // Extrair resultados do retorno
    // processPolygon sempre retorna 5 valores: (result, debugInfo, labelEquivalencies, totalLabels, bbox)
    const result = await contract.callStatic.processPolygon(latitudes, longitudes, precision, labelsDebug);
    const geohashes = result[0];
    const debugInfo = result[1];
    const labelEquivalencies = result[2];
    const totalLabels = result[3];
    const bboxDebug = result[4];
    
    // Salvar resultados
    polygonState.geohashResults = geohashes;
    
    if (labelsDebug && debugInfo.length > 0) {
      // Debug info está presente
      addLogEntry(`🎉 Debug concluído! ${geohashes.length} geohashes, ${totalLabels.toString()} labels`, 'success');
      console.log('Debug Info:', { geohashes, debugInfo, labelEquivalencies, totalLabels, bboxDebug });
      
      polygonState.debugInfo = {
        info: debugInfo,
        equivalencies: labelEquivalencies,
        totalLabels: totalLabels.toNumber(),
        bbox: bboxDebug
      };
    } else {
      // Debug desabilitado, arrays vazios
      addLogEntry(`🎉 Processamento concluído! ${geohashes.length} geohashes retornados`, 'success');
      console.log('Geohashes retornados:', geohashes);
      polygonState.debugInfo = null;
    }
    
    // Atualizar UI
    showTestStatus(`✅ ${polygonState.geohashResults.length} geohashes processados`, 'success');
    
    // Renderizar resultados no canvas
    renderPolygonState();
    
  } catch (error) {
    console.error('Erro ao processar polígono:', error);
    addLogEntry(`❌ Erro: ${error.message}`, 'error');
    showTestStatus(`Erro: ${error.message}`, 'error');
  } finally {
    polygonState.isProcessing = false;
  }
}

/**
 * Converte número para int256 com DECIMALS_FACTOR (10^18)
 */
function toInt256WithDecimals(value) {
  const valueStr = value.toFixed(18);
  const [intPart, decPart = ''] = valueStr.split('.');
  const decPartPadded = decPart.padEnd(18, '0').substring(0, 18);
  const fullValueStr = intPart + decPartPadded;
  return ethers.BigNumber.from(fullValueStr);
}

/**
 * Converte bytes32 para Z-Order index
 */
function bytes32ToZOrderIndex(bytes32Hex, precision) {
  let hexStr;
  
  if (typeof bytes32Hex === 'object') {
    if (bytes32Hex.toHexString) {
      hexStr = bytes32Hex.toHexString();
    } else {
      hexStr = '0x' + bytes32Hex.toString(16);
    }
  } else {
    hexStr = bytes32Hex.toString();
  }
  
  const hex = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr;
  const fullValue = BigInt('0x' + hex);
  const mask = (BigInt(1) << BigInt(2 * precision)) - BigInt(1);
  const zOrderIndex = Number(fullValue & mask);
  
  return zOrderIndex;
}

/**
 * Limpa o polígono - RESET COMPLETO como F5
 */
function clearPolygon() {
  // Resetar TODOS os estados
  polygonState.points = [];
  polygonState.geohashResults = [];
  polygonState.debugInfo = null;
  polygonState.snapPoint = null;
  polygonState.inputMode = 'click';
  polygonState.isProcessing = false;
  
  // Resetar UI
  updatePolygonUI();
  
  // Limpar canvas e redesenhar grid limpo
  if (window.GeohashGrid && window.appState) {
    GeohashGrid.drawGrid(window.appState.precision);
  }
  
  // Limpar coordenadas snap
  updateSnapCoords(null, null);
  
  // Resetar seletor de input mode
  const inputModeSelect = document.getElementById('polygon-input-mode-select');
  if (inputModeSelect) {
    inputModeSelect.value = 'click';
  }
  
  addLogEntry('🗑️ Estado resetado completamente', 'info');
  showTestStatus('Estado resetado', 'normal');
}

/**
 * Atualiza UI do polígono
 */
function updatePolygonUI() {
  const pointsList = document.getElementById('polygon-points-list');
  if (!pointsList) return;
  
  // Limpar lista
  pointsList.innerHTML = '';
  
  // Adicionar pontos
  polygonState.points.forEach((point, index) => {
    const pointEl = document.createElement('div');
    pointEl.className = 'polygon-point';
    pointEl.innerHTML = `
      <span class="polygon-point-number">${index + 1}.</span>
      <span class="polygon-point-coords">
        Lat: ${point.lat.toFixed(4)}, Lon: ${point.lon.toFixed(4)}
      </span>
      <button class="polygon-point-remove" data-index="${index}">✕</button>
    `;
    
    // Botão de remover
    const removeBtn = pointEl.querySelector('.polygon-point-remove');
    removeBtn.addEventListener('click', () => {
      polygonState.points.splice(index, 1);
      polygonState.geohashResults = []; // Limpar resultados ao remover ponto
      updatePolygonUI();
      renderPolygonState();
      addLogEntry(`Ponto ${index + 1} removido`, 'info');
    });
    
    pointsList.appendChild(pointEl);
  });
  
  // Mostrar/esconder input manual
  const manualForm = document.getElementById('polygon-manual-form');
  if (manualForm) {
    manualForm.style.display = polygonState.inputMode === 'manual' ? 'flex' : 'none';
  }
  
  // Atualizar contador
  const counterEl = document.getElementById('polygon-points-count');
  if (counterEl) {
    counterEl.textContent = `${polygonState.points.length} pontos`;
  }
  
  // Habilitar/desabilitar botão de processar
  const processBtn = document.getElementById('polygon-process-btn');
  if (processBtn) {
    processBtn.disabled = polygonState.points.length < 3;
  }
}

/**
 * Renderiza estado do polígono no canvas
 */
function renderPolygonState() {
  // Re-desenhar grid base (linhas do grid SEMPRE sólidas, não tracejadas)
  if (window.GeohashGrid && window.appState) {
    GeohashGrid.drawGrid(window.appState.precision);
  }
  
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const precision = window.appState.precision;
  
  // IMPORTANTE: Garantir que o lineDash está resetado após drawGrid
  ctx.setLineDash([]);
  
  // 1. Desenhar geohashes retornados (se houver)
  if (polygonState.geohashResults.length > 0) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([]); // Garantir linha sólida
    
    const cellSize = GeohashUtils.getCellSize(precision);
    
    polygonState.geohashResults.forEach(geohash => {
      const zOrderIndex = bytes32ToZOrderIndex(geohash, precision);
      const { gridX, gridY } = zOrderToGrid(zOrderIndex, precision);
      const x = gridX * cellSize.width;
      const y = gridY * cellSize.height;
      
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(x, y, cellSize.width, cellSize.height);
    });
    
    ctx.restore();
    ctx.setLineDash([]); // Garantir linha sólida após restore
  }
  
  // 1.5. Desenhar labels de debug (se houver)
  if (polygonState.debugInfo) {
    ctx.save();
    ctx.setLineDash([]); // Garantir linha sólida
    
    const cellSize = GeohashUtils.getCellSize(precision);
    const debugInfo = polygonState.debugInfo.info;
    
    debugInfo.forEach(info => {
      const zOrderIndex = bytes32ToZOrderIndex(info.geohash, precision);
      const { gridX, gridY } = zOrderToGrid(zOrderIndex, precision);
      const centerX = (gridX + 0.5) * cellSize.width;
      const centerY = (gridY + 0.5) * cellSize.height;
      
      // Cor baseada no status
      if (info.isInternal) {
        ctx.fillStyle = '#4CAF50'; // Verde para interno
        ctx.strokeStyle = '#2E7D32';
      } else {
        ctx.fillStyle = '#FF5722'; // Vermelho para externo/borda
        ctx.strokeStyle = '#C62828';
      }
      
      // Desenhar círculo pequeno
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Desenhar label (número)
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(info.finalLabel.toString(), centerX, centerY);
    });
    
    ctx.restore();
    ctx.setLineDash([]); // Garantir linha sólida após restore
  }
  
  // 2. Desenhar linhas entre os pontos (CHEIAS entre pontos, TRACEJADA até red dot)
  if (polygonState.points.length > 0) {
    ctx.save();
    
    // Desenhar linhas CHEIAS entre pontos consecutivos
    if (polygonState.points.length > 1) {
      ctx.strokeStyle = '#FFC107'; // Amarelo
      ctx.lineWidth = 2;
      ctx.setLineDash([]); // Linha cheia (EXPLICITAMENTE)
      
      ctx.beginPath();
      
      // Primeiro ponto
      const firstPoint = GeohashUtils.latLonToCanvas(
        polygonState.points[0].lat,
        polygonState.points[0].lon
      );
      ctx.moveTo(firstPoint.x, firstPoint.y);
      
      // Demais pontos
      for (let i = 1; i < polygonState.points.length; i++) {
        const point = GeohashUtils.latLonToCanvas(
          polygonState.points[i].lat,
          polygonState.points[i].lon
        );
        ctx.lineTo(point.x, point.y);
      }
      
      ctx.stroke();
      
      // LINHA DE FECHAMENTO: último → primeiro (se tiver 3+ pontos)
      if (polygonState.points.length >= 3) {
        ctx.strokeStyle = '#FFC107'; // Amarelo
        ctx.lineWidth = 2;
        ctx.setLineDash([]); // Linha cheia
        
        ctx.beginPath();
        
        const lastPoint = GeohashUtils.latLonToCanvas(
          polygonState.points[polygonState.points.length - 1].lat,
          polygonState.points[polygonState.points.length - 1].lon
        );
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(firstPoint.x, firstPoint.y); // Volta para o primeiro
        
        ctx.stroke();
      }
    }
    
    // Desenhar linha TRACEJADA do último ponto até o red dot
    if (polygonState.snapPoint && polygonState.inputMode === 'click') {
      ctx.strokeStyle = '#FFC107'; // Amarelo
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]); // Linha tracejada (EXPLICITAMENTE)
      
      ctx.beginPath();
      
      const lastPoint = GeohashUtils.latLonToCanvas(
        polygonState.points[polygonState.points.length - 1].lat,
        polygonState.points[polygonState.points.length - 1].lon
      );
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(polygonState.snapPoint.canvasX, polygonState.snapPoint.canvasY);
      
      ctx.stroke();
    }
    
    ctx.restore();
    ctx.setLineDash([]); // RESETAR linha para sólida após restore
  }
  
  // 3. Desenhar pontos do polígono (AMARELO com borda PRETA e números)
  ctx.setLineDash([]); // Garantir linha sólida antes de desenhar círculos
  
  polygonState.points.forEach((point, index) => {
    const pixel = GeohashUtils.latLonToCanvas(point.lat, point.lon);
    
    ctx.save();
    ctx.setLineDash([]); // Garantir linha sólida
    
    // Círculo amarelo
    ctx.fillStyle = '#FFC107';
    ctx.beginPath();
    ctx.arc(pixel.x, pixel.y, 7, 0, Math.PI * 2);
    ctx.fill();
    
    // Borda preta
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Número do ponto (preto para contrastar com amarelo)
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((index + 1).toString(), pixel.x, pixel.y);
    
    ctx.restore();
    ctx.setLineDash([]); // RESETAR após restore
  });
  
  // 4. Desenhar PONTO VERMELHO com snap (bolinha vermelha) - SEMPRE visível no modo click
  if (polygonState.snapPoint && polygonState.inputMode === 'click') {
    ctx.save();
    ctx.setLineDash([]); // Garantir linha sólida
    
    // Desenhar bolinha vermelha (tamanho reduzido: raio 4)
    ctx.beginPath();
    ctx.arc(polygonState.snapPoint.canvasX, polygonState.snapPoint.canvasY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.fill();
    
    // Borda branca
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    ctx.restore();
    ctx.setLineDash([]); // RESETAR após restore
  }
}

/**
 * Converte Z-Order index para coordenadas de grid
 * @param {number} zOrderIndex - Índice Z-Order
 * @param {number} precision - Precisão do grid
 * @returns {{gridX: number, gridY: number}}
 */
function zOrderToGrid(zOrderIndex, precision) {
  let gridX = 0;
  let gridY = 0;
  
  // Decodificar Z-Order (intercalar bits: lon, lat, lon, lat...)
  for (let i = 0; i < precision; i++) {
    const bit = (zOrderIndex >> (2 * i)) & 3;
    
    // bit = 0 (00): canto inferior esquerdo
    // bit = 1 (01): canto inferior direito
    // bit = 2 (10): canto superior esquerdo  
    // bit = 3 (11): canto superior direito
    
    const xBit = bit & 1;       // bit menos significativo (longitude)
    const yBit = (bit >> 1) & 1; // bit mais significativo (latitude)
    
    gridX |= (xBit << i);
    gridY |= (yBit << i);
  }
  
  return { gridX, gridY };
}

/**
 * Calcula snap to edge (ponto vermelho que gruda nas edges do grid)
 * @param {number} mouseX - Posição X do mouse no canvas
 * @param {number} mouseY - Posição Y do mouse no canvas
 * @param {number} precision - Precisão do grid
 * @returns {object} - Objeto com { lat, lon, canvasX, canvasY }
 */
function calculateSnapToEdge(mouseX, mouseY, precision) {
  const { lat, lon } = GeohashUtils.canvasToLatLon(mouseX, mouseY);
  const cellSize = GeohashUtils.getCellSize(precision);
  
  // Calcular qual célula estamos
  const gridX = Math.floor(mouseX / cellSize.width);
  const gridY = Math.floor(mouseY / cellSize.height);
  
  // Posições das arestas da célula
  const leftEdge = gridX * cellSize.width;
  const rightEdge = (gridX + 1) * cellSize.width;
  const topEdge = gridY * cellSize.height;
  const bottomEdge = (gridY + 1) * cellSize.height;
  
  // Distâncias para cada aresta
  const distToLeft = Math.abs(mouseX - leftEdge);
  const distToRight = Math.abs(mouseX - rightEdge);
  const distToTop = Math.abs(mouseY - topEdge);
  const distToBottom = Math.abs(mouseY - bottomEdge);
  
  let snappedX = mouseX;
  let snappedY = mouseY;
  let snappedLat = lat;
  let snappedLon = lon;
  
  // Snap para aresta vertical mais próxima (ajusta longitude)
  if (distToLeft < polygonState.snapThreshold) {
    snappedX = leftEdge;
    const snapped = GeohashUtils.canvasToLatLon(leftEdge, mouseY);
    snappedLat = snapped.lat;
    snappedLon = snapped.lon;
  } else if (distToRight < polygonState.snapThreshold) {
    snappedX = rightEdge;
    const snapped = GeohashUtils.canvasToLatLon(rightEdge, mouseY);
    snappedLat = snapped.lat;
    snappedLon = snapped.lon;
  }
  
  // Snap para aresta horizontal mais próxima (ajusta latitude)
  if (distToTop < polygonState.snapThreshold) {
    snappedY = topEdge;
    const snapped = GeohashUtils.canvasToLatLon(snappedX, topEdge);
    snappedLat = snapped.lat;
    snappedLon = snapped.lon;
  } else if (distToBottom < polygonState.snapThreshold) {
    snappedY = bottomEdge;
    const snapped = GeohashUtils.canvasToLatLon(snappedX, bottomEdge);
    snappedLat = snapped.lat;
    snappedLon = snapped.lon;
  }
  
  return {
    lat: snappedLat,
    lon: snappedLon,
    canvasX: snappedX,
    canvasY: snappedY
  };
}

/**
 * Atualiza coordenadas snap na UI
 */
function updateSnapCoords(lat, lon) {
  const snapCoords = document.getElementById('snap-coords');
  const snapLat = document.getElementById('snap-lat');
  const snapLon = document.getElementById('snap-lon');
  
  if (!snapCoords || !snapLat || !snapLon) return;
  
  if (lat === null || lon === null) {
    snapCoords.style.display = 'none';
  } else {
    snapCoords.style.display = 'block';
    snapLat.textContent = lat.toFixed(4) + '°';
    snapLon.textContent = lon.toFixed(4) + '°';
  }
}

/**
 * Atualiza status do teste
 */
function showTestStatus(message, type = 'normal') {
  const statusEl = document.getElementById('test-status');
  const statusText = document.getElementById('status-text');
  
  if (statusEl && statusText) {
    statusText.textContent = message;
    
    // Remover classes anteriores
    statusEl.classList.remove('loading', 'success', 'error', 'hidden');
    
    // Adicionar nova classe
    if (type !== 'normal') {
      statusEl.classList.add(type);
    }
    
    // Esconder automaticamente após 2 segundos (exceto para erros)
    if (type !== 'error' && type !== 'loading') {
      setTimeout(() => {
        if (statusEl) {
          statusEl.classList.add('hidden');
        }
      }, 2000);
    }
  }
}

/**
 * Adiciona entrada ao log
 */
function addLogEntry(message, type = 'info') {
  const logContainer = document.getElementById('log');
  if (!logContainer) {
    console.log(`[${type.toUpperCase()}] ${message}`);
    return;
  }
  
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  
  // Adicionar no final
  logContainer.appendChild(entry);
  
  // Limitar a 50 entradas
  while (logContainer.children.length > 50) {
    logContainer.removeChild(logContainer.firstChild);
  }
  
  // Auto-scroll para o bottom
  const logSection = document.getElementById('log-section');
  if (logSection) {
    setTimeout(() => {
      logSection.scrollTop = logSection.scrollHeight;
    }, 0);
  }
}

/**
 * Reseta o handler quando trocar de tab
 */
function resetProcessPolygonHandler() {
  clearPolygon();
  updateSnapCoords(null, null);
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.ProcessPolygonHandler = {
    init: initProcessPolygonHandler,
    reset: resetProcessPolygonHandler,
    state: polygonState
  };
}

