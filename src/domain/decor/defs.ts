export const frameTypes = [
    "roundframe1",
    "roundframe2",
    "roundframe3",
    "roundframe4",
    "squareframe1",
    "squareframe2",
    "squareframe3",
    "archedframe1",
] as const;

export const frameType = [...frameTypes] as const;
