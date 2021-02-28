// eslint-disable-next-line import/prefer-default-export
export const isHaveRecords = (input: unknown): input is { Records: unknown[] } => {
  return (
    typeof input === 'object' &&
    input !== null &&
    Array.isArray((input as { Records: unknown[] }).Records)
  );
};
