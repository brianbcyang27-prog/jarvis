// Chain-of-Thought Reasoning Module for JARVIS
// Enhances reasoning capabilities for complex problems

const crypto = require('crypto');

class ChainOfThought {
  constructor(options = {}) {
    this.maxSteps = options.maxSteps || 5;
    this.temperature = options.temperature || 0.7;
    this.enableSelfCheck = options.enableSelfCheck !== false;
  }
  
  /**
   * Generate a chain of thought for a given prompt
   * @param {string} prompt - The original user query
   * @param {Function} generateResponse - Function to generate AI response
   * @param {Object} context - Additional context (model, agent, etc.)
   * @returns {Promise<Object>} - Reasoning trace and final answer
   */
  async reason(prompt, generateResponse, context = {}) {
    const startTime = Date.now();
    const reasoningSteps = [];
    
    try {
      // Step 1: Problem decomposition
      const decompositionPrompt = `
You are an AI assistant tasked with breaking down complex problems into simpler steps.
Given the following problem, break it down into logical steps that need to be solved.
Provide your response as a numbered list of steps.

Problem: ${prompt}

Steps:`;
      
      const decomposition = await generateResponse(decompositionPrompt, context);
      const steps = this.parseSteps(decomposition);
      
      // Step 2: Execute each step with context from previous steps
      let stepContext = {};
      let accumulatedKnowledge = "";
      
      for (let i = 0; i < Math.min(steps.length, this.maxSteps); i++) {
        const stepPrompt = `
You are working on solving a complex problem. You have already completed these steps:
${accumulatedKnowledge}

Now work on this step:
Step ${i + 1}: ${steps[i]}

Provide your reasoning and any intermediate conclusions for this step:`;
        
        const stepResponse = await generateResponse(stepPrompt, {
          ...context,
          stepNumber: i + 1,
          totalSteps: steps.length,
          previousKnowledge: accumulatedKnowledge
        });
        
        reasoningSteps.push({
          step: i + 1,
          description: steps[i],
          reasoning: stepResponse,
          timestamp: Date.now()
        });
        
        // Update accumulated knowledge for next step
        accumulatedKnowledge += `\nStep ${i + 1}: ${steps[i]}\nConclusion: ${stepResponse}\n`;
        
        // Optional: Self-check after each step
        if (this.enableSelfCheck && i < steps.length - 1) {
          const selfCheckPrompt = `
Review your reasoning for step ${i + 1}:
${stepResponse}

Does this make sense given the problem so far? Identify any potential errors or gaps in logic.
Provide a brief assessment and any corrections needed:`;
          
          const selfCheck = await generateResponse(selfCheckPrompt, context);
          reasoningSteps[reasoningSteps.length - 1].selfCheck = selfCheck;
        }
      }
      
      // Step 3: Synthesize final answer
      const synthesisPrompt = `
You have completed reasoning through a complex problem using these steps:
${reasoningSteps.map((s, i) => `${i + 1}. ${s.description}: ${s.reasoning.substring(0, 100)}...`).join('\n')}

Based on this reasoning process, provide a clear, concise final answer to the original problem:
${prompt}

Final Answer:`;
      
      const finalAnswer = await generateResponse(synthesisPrompt, context);
      
      // Optional: Final self-check
      let finalSelfCheck = null;
      if (this.enableSelfCheck) {
        const finalCheckPrompt = `
Review your final answer:
${finalAnswer}

Does this fully address the original problem: ${prompt}?
Check for completeness, accuracy, and relevance.
Provide any improvements or note if the answer is satisfactory:`;
        
        finalSelfCheck = await generateResponse(finalCheckPrompt, context);
      }
      
      const endTime = Date.now();
      
      return {
        originalPrompt: prompt,
        reasoningSteps: reasoningSteps,
        finalAnswer: finalAnswer,
        finalSelfCheck: finalSelfCheck,
        totalSteps: reasoningSteps.length,
        processingTimeMs: endTime - startTime,
        timestamp: startTime
      };
    } catch (error) {
      console.error('Error in chain-of-thought reasoning:', error);
      // Fallback to direct response
      const fallbackResponse = await generateResponse(prompt, context);
      return {
        originalPrompt: prompt,
        reasoningSteps: [],
        finalAnswer: fallbackResponse,
        error: error.message,
        processingTimeMs: Date.now() - startTime,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Parse steps from AI response (expects numbered list)
   * @param {string} text - AI response containing steps
   * @returns {Array<string>} - Parsed steps
   */
  parseSteps(text) {
    // Look for numbered lists (1. 2. 3. etc.)
    const stepMatches = text.match(/(\d+\.[^\n]*)/g);
    if (stepMatches) {
      return stepMatches.map(step => step.replace(/^\d+\.\s*/, '').trim());
    }
    
    // Look for bullet points or dashed lists
    const bulletMatches = text.match(/([\-\*]\s*[^\n]*)/g);
    if (bulletMatches) {
      return bulletMatches.map(step => step.replace(/^[\-\*]\s*/, '').trim());
    }
    
    // Fallback: split by lines and filter reasonable length
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 10);
    if (lines.length >= 3) {
      return lines.slice(0, this.maxSteps);
    }
    
    // Last resort: treat as single step
    return [text.trim()];
  }
  
  /**
   * Format chain of thought result for display
   * @param {Object} result - Result from reason() method
   * @returns {string} - Formatted reasoning trace
   */
  formatForDisplay(result) {
    let output = `🔍 *Chain-of-Thought Reasoning*\n\n`;
    output += `*Problem:* ${result.originalPrompt}\n\n`;
    
    if (result.reasoningSteps.length > 0) {
      output += `*Reasoning Steps:*\n`;
      result.reasoningSteps.forEach((step, index) => {
        output += `${index + 1}. ${step.description}\n`;
        output += `   💭 ${step.reasoning.substring(0, 150)}${step.reasoning.length > 150 ? '...' : ''}\n`;
        if (step.selfCheck) {
          output += `   🔍 Self-check: ${step.selfCheck.substring(0, 100)}${step.selfCheck.length > 100 ? '...' : ''}\n`;
        }
        output += '\n';
      });
    }
    
    output += `*Final Answer:*\n${result.finalAnswer}\n\n`;
    
    if (result.finalSelfCheck) {
      output += `*Final Validation:*\n${result.finalSelfCheck}\n\n`;
    }
    
    output += `⏱️ Processing time: ${result.processingTimeMs}ms\n`;
    output += `🧠 Steps used: ${result.totalSteps}/${this.maxSteps}`;
    
    return output;
  }
}

// Singleton instance
let instance = null;

function getChainOfThought(options = {}) {
  if (!instance) {
    instance = new ChainOfThought(options);
  }
  return instance;
}

module.exports = { ChainOfThought, getChainOfThought };