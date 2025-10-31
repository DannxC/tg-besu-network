/* eslint-env browser */
/**
 * Módulo de interação com o contrato GeohashConverter
 */

let contractInfo = null;
let contractInstance = null;
let provider = null;
let signer = null;
let ethersInitialized = false; // Flag para evitar inicialização duplicada
let contractLoading = false; // Flag para evitar carregamento simultâneo

/**
 * Carrega informações do contrato via API do servidor
 * @returns {Promise<Object>} Informações do contrato
 */
async function loadContract() {
  // Se já está carregado, retornar cache
  if (contractInfo && contractInstance) {
    return contractInfo;
  }
  
  // Se já está carregando, aguardar
  if (contractLoading) {
    // Aguardar até que termine (polling simples)
    let attempts = 0;
    while (contractLoading && attempts < 50) { // Máximo 5 segundos
      await new Promise(resolve => {
        // eslint-disable-next-line no-undef
        setTimeout(resolve, 100);
      });
      attempts++;
    }
    if (contractInfo && contractInstance) {
      return contractInfo;
    }
  }
  
  contractLoading = true;
  
  try {
    const response = await fetch('/api/contract');
    
    if (!response.ok) {
      throw new Error('Falha ao carregar contrato');
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    contractInfo = data;
    console.log('✅ Contrato carregado:', contractInfo);
    
    // Inicializar ethers.js provider e contract instance
    await initializeEthers();
    
    return contractInfo;
    
  } catch (error) {
    console.error('❌ Erro ao carregar contrato:', error);
    throw error;
  } finally {
    contractLoading = false;
  }
}

/**
 * Inicializa provider e instância do contrato com ethers.js
 */
async function initializeEthers() {
  // Evitar inicialização duplicada
  if (ethersInitialized && contractInstance) {
    return;
  }
  
  try {
    if (!contractInfo) {
      throw new Error('Contract info não carregado');
    }
    
    ethersInitialized = true;
    
    // Criar provider apontando para a rede Besu
    // OBS: contractInfo.network é apenas o nome ('besu'), não a URL
    const rpcUrl = 'http://localhost:8545';
    provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // INTERCEPTAR REQUISIÇÕES RPC PARA LOGS
    // Ethers.js v5 usa 'send' e 'call' para fazer requisições
    const originalSend = provider.send.bind(provider);
    const originalCall = provider.call ? provider.call.bind(provider) : null;
    
    provider.send = async function(method, params) {
      const requestId = Date.now();
      console.log(`📡 [RPC REQUEST #${requestId}] Método: ${method}`);
      console.log(`📡 [RPC REQUEST #${requestId}] URL: ${rpcUrl}`);
      console.log(`📡 [RPC REQUEST #${requestId}] Params:`, JSON.stringify(params, null, 2));
      
      const startTime = Date.now();
      try {
        const result = await originalSend(method, params);
        const duration = Date.now() - startTime;
        console.log(`✅ [RPC RESPONSE #${requestId}] Sucesso em ${duration}ms`);
        console.log(`✅ [RPC RESPONSE #${requestId}] Result:`, typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ [RPC ERROR #${requestId}] Erro após ${duration}ms:`, error.message);
        console.error(`❌ [RPC ERROR #${requestId}] Stack:`, error.stack);
        throw error;
      }
    };
    
    // Interceptar também 'call' se existir
    if (originalCall) {
      provider.call = async function(transaction, blockTag) {
        const requestId = Date.now();
        console.log(`📡 [RPC CALL #${requestId}] Transaction:`, JSON.stringify(transaction, null, 2));
        console.log(`📡 [RPC CALL #${requestId}] BlockTag:`, blockTag);
        
        const startTime = Date.now();
        try {
          const result = await originalCall(transaction, blockTag);
          const duration = Date.now() - startTime;
          console.log(`✅ [RPC CALL RESPONSE #${requestId}] Sucesso em ${duration}ms`);
          console.log(`✅ [RPC CALL RESPONSE #${requestId}] Result:`, result);
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          console.error(`❌ [RPC CALL ERROR #${requestId}] Erro após ${duration}ms:`, error.message);
          throw error;
        }
      };
    }
    
    // VERIFICAR CONEXÃO COM RPC NODE
    try {
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      console.log('✅ [RPC] Conectado! Chain ID:', network.chainId.toString(), 'Block:', blockNumber);
    } catch (rpcError) {
      console.error('❌ [RPC] ERRO ao conectar:', rpcError);
      throw new Error('Não foi possível conectar ao RPC node: ' + rpcError.message);
    }
    
    // Verificar se o contrato existe no endereço
    const contractCode = await provider.getCode(contractInfo.address);
    if (contractCode === '0x' || contractCode === '0x0') {
      throw new Error(`Contrato não encontrado no endereço ${contractInfo.address}. Verifique se foi deployado.`);
    }
    
    // Obter private key da conta 1 (hardcoded para teste)
    // OBS: Em produção, isso deve vir de forma segura
    const privateKey = '0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63'; // Account #1
    signer = new ethers.Wallet(privateKey, provider);
    
    // Buscar ABI do contrato
    const abiResponse = await fetch('/api/abi');
    if (!abiResponse.ok) {
      throw new Error('Falha ao carregar ABI do contrato');
    }
    
    const abiData = await abiResponse.json();
    const abi = abiData.abi;
    
    // Criar instância do contrato
    contractInstance = new ethers.Contract(
      contractInfo.address,
      abi,
      signer
    );
    
    console.log('✅ Contrato instanciado:', contractInfo.address);
    
  } catch (error) {
    console.error('❌ Erro ao inicializar ethers:', error);
    throw error;
  }
}

/**
 * Obtém a instância do contrato
 * @returns {ethers.Contract|null} Instância do contrato ou null
 */
function getContract() {
  return contractInstance;
}

/**
 * Obtém informações do contrato (cached)
 * @returns {Object|null} Informações do contrato ou null se não carregado
 */
function getContractInfo() {
  return contractInfo;
}

/**
 * Valida se o contrato foi carregado
 * @returns {boolean} True se contrato está carregado
 */
function isContractLoaded() {
  return contractInfo !== null;
}

/**
 * Obtém a precision máxima do contrato
 * @returns {number|null} Precision ou null se não carregado
 */
function getMaxPrecision() {
  return contractInfo ? contractInfo.precision : null;
}

/**
 * Obtém o endereço do contrato
 * @returns {string|null} Endereço ou null se não carregado
 */
function getContractAddress() {
  return contractInfo ? contractInfo.address : null;
}

// Funções para futuras interações com o contrato
// (serão implementadas posteriormente)

/**
 * Converte lat/lon para geohash (futura implementação)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} precision - Precision
 * @returns {Promise<string>} Geohash
 */
async function latLongToGeohash(lat, lon, precision) {
  // TODO: Implementar chamada ao contrato
  console.log('latLongToGeohash:', { lat, lon, precision });
  throw new Error('Função ainda não implementada');
}

/**
 * Converte geohash para lat/lon (futura implementação)
 * @param {string} geohash - Geohash
 * @param {number} precision - Precision
 * @returns {Promise<{lat: number, lon: number}>} Coordenadas
 */
async function geohashToLatLong(geohash, precision) {
  // TODO: Implementar chamada ao contrato
  console.log('geohashToLatLong:', { geohash, precision });
  throw new Error('Função ainda não implementada');
}

/**
 * Processa polígono (futura implementação)
 * @param {Array<number>} latitudes - Array de latitudes
 * @param {Array<number>} longitudes - Array de longitudes
 * @param {number} precision - Precision
 * @returns {Promise<Array<string>>} Array de geohashes
 */
async function processPolygon(latitudes, longitudes, precision) {
  // TODO: Implementar chamada ao contrato
  console.log('processPolygon:', { latitudes, longitudes, precision });
  throw new Error('Função ainda não implementada');
}

// Exportar para uso global no browser
if (typeof window !== 'undefined') {
  window.GeohashContract = {
    loadContract,
    getContract,
    getContractInfo,
    isContractLoaded,
    getMaxPrecision,
    getContractAddress,
    latLongToGeohash,
    geohashToLatLong,
    processPolygon
  };
}
