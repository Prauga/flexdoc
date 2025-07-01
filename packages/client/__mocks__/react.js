const react = jest.requireActual('react');

module.exports = {
  ...react,
  useState: jest.fn().mockImplementation((initial) => [initial, jest.fn()]),
  useEffect: jest.fn().mockImplementation((fn) => fn()),
};

