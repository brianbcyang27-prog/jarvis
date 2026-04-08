// Enhanced Memory System with Vector Embeddings for JARVIS
// Provides semantic search and contextual understanding

const { pipeline } = require('@xenova/transformers');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class EnhancedMemory {
  constructor(options = {}) {
    this.memoryDir = options.memoryDir || '/Users/openclaw/.jarvis/enhanced';
    this.embeddingModel = null;
    this.memories = [];
    this.embeddings = [];
    this.maxMemories = options.maxMemories || 1000;
    this.similarityThreshold = options.similarityThreshold || 0.7;
    
    // Ensure memory directory exists
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
    
    // Load existing memories
    this.loadMemories();
  }
  
  async initialize() {
    try {
      console.log('🧠 Loading embedding model for enhanced memory...');
      // Use a lightweight model for sentence embeddings
      this.embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('✅ Embedding model loaded');
      
      // Generate embeddings for existing memories
      await this.refreshEmbeddings();
    } catch (error) {
      console.error('❌ Failed to initialize enhanced memory:', error);
      // Fallback to basic memory if embeddings fail
      this.embeddingModel = null;
    }
  }
  
  async generateEmbedding(text) {
    if (!this.embeddingModel) {
      // Fallback: simple TF-IDF like approach or return null
      return null;
    }
    
    try {
      const output = await this.embeddingModel(text, { pooling: 'mean' });
      // Convert to regular array and normalize
      const embedding = Array.from(output.data);
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return null;
    }
  }
  
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  async addMemory(content, metadata = {}) {
    const memoryId = uuidv4();
    const timestamp = Date.now();
    
    const memory = {
      id: memoryId,
      content: content,
      timestamp: timestamp,
      metadata: metadata,
      accessed: 0,
      lastAccessed: timestamp
    };
    
    // Generate embedding for semantic search
    const embedding = await this.generateEmbedding(content);
    if (embedding) {
      memory.embedding = embedding;
    }
    
    // Add to memories array
    this.memories.push(memory);
    
    // Maintain size limit
    if (this.memories.length > this.maxMemories) {
      // Remove oldest accessed memory
      this.memories.sort((a, b) => a.lastAccessed - b.lastAccessed);
      this.memories.shift();
    }
    
    // Save to disk
    await this.saveMemories();
    
    return memoryId;
  }
  
  async searchMemories(query, limit = 5) {
    if (!this.embeddingModel || this.memories.length === 0) {
      // Fallback to text search
      return this.fallbackTextSearch(query, limit);
    }
    
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      if (!queryEmbedding) {
        return this.fallbackTextSearch(query, limit);
      }
      
      // Calculate similarities
      const similarities = this.memories.map((memory, index) => ({
        index,
        similarity: this.cosineSimilarity(queryEmbedding, memory.embedding),
        memory: memory
      }));
      
      // Filter by threshold and sort
      const filtered = similarities
        .filter(item => item.similarity >= this.similarityThreshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      
      // Update access stats
      filtered.forEach(item => {
        const memory = this.memories[item.index];
        memory.accessed += 1;
        memory.lastAccessed = Date.now();
      });
      
      // Save updated access stats
      await this.saveMemories();
      
      return filtered.map(item => item.memory);
    } catch (error) {
      console.error('Error in semantic search:', error);
      return this.fallbackTextSearch(query, limit);
    }
  }
  
  fallbackTextSearch(query, limit) {
    const queryLower = query.toLowerCase();
    const results = this.memories
      .filter(memory => 
        memory.content.toLowerCase().includes(queryLower) ||
        Object.values(memory.metadata).some(val => 
          String(val).toLowerCase().includes(queryLower)
        )
      )
      .sort((a, b) => b.accessed - a.accessed)
      .slice(0, limit);
    
    // Update access stats
    results.forEach(memory => {
      memory.accessed += 1;
      memory.lastAccessed = Date.now();
    });
    
    return results;
  }
  
  async getRecentMemories(limit = 10) {
    return this.memories
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  async saveMemories() {
    const memoriesData = this.memories.map(memory => ({
      id: memory.id,
      content: memory.content,
      timestamp: memory.timestamp,
      metadata: memory.metadata,
      accessed: memory.accessed,
      lastAccessed: memory.lastAccessed,
      embedding: memory.embedding // This will be large, consider storing separately
    }));
    
    const data = {
      memories: memoriesData,
      version: '1.0',
      updated: Date.now()
    };
    
    try {
      fs.writeFileSync(
        path.join(this.memoryDir, 'memories.json'),
        JSON.stringify(data, null, 2)
      );
    } catch (error) {
      console.error('Error saving memories:', error);
    }
  }
  
  loadMemories() {
    try {
      const filePath = path.join(this.memoryDir, 'memories.json');
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.memories = data.memories || [];
        console.log(`🧠 Loaded ${this.memories.length} memories from storage`);
      }
    } catch (error) {
      console.error('Error loading memories:', error);
      this.memories = [];
    }
  }
  
  async refreshEmbeddings() {
    if (!this.embeddingModel || this.memories.length === 0) return;
    
    console.log('🔄 Refreshing embeddings for existing memories...');
    for (let i = 0; i < this.memories.length; i++) {
      if (!this.memories[i].embedding) {
        const embedding = await this.generateEmbedding(this.memories[i].content);
        if (embedding) {
          this.memories[i].embedding = embedding;
        }
      }
      
      // Progress indicator for large memory sets
      if (i % 100 === 0) {
        console.log(`  Processed ${i}/${this.memories.length} memories`);
      }
    }
    
    await this.saveMemories();
    console.log('✅ Embeddings refreshed');
  }
  
  getStats() {
    return {
      totalMemories: this.memories.length,
      memoriesWithEmbeddings: this.memories.filter(m => m.embedding).length,
      embeddingModelLoaded: !!this.embeddingModel,
      memoryDir: this.memoryDir
    };
  }
}

// Singleton instance
let instance = null;

async function getEnhancedMemory(options = {}) {
  if (!instance) {
    instance = new EnhancedMemory(options);
    await instance.initialize();
  }
  return instance;
}

module.exports = { EnhancedMemory, getEnhancedMemory };