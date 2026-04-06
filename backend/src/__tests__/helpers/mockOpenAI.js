/**
 * OpenAI mock factory.
 * Usage:
 *   jest.mock('openai', () => require('../helpers/mockOpenAI').MockOpenAI);
 *   const { getCreateMock } = require('../helpers/mockOpenAI');
 *
 *   // In test:
 *   getCreateMock().mockResolvedValue(createOpenAIResponse({ ... }));
 */

const mockCreate = jest.fn();

function MockOpenAI() {
  return {
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  };
}

function createOpenAIResponse(content) {
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  return {
    choices: [
      {
        message: {
          content: contentStr,
        },
      },
    ],
  };
}

function getCreateMock() {
  return mockCreate;
}

module.exports = { MockOpenAI, createOpenAIResponse, getCreateMock };
