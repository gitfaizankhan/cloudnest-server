const asyncHandler = (handler) =>
  function asyncUtilWrap(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

export { asyncHandler };
