import qm1 from "./assets/qm1.gif";
import qm2 from "./assets/qm2.gif";
import qm3 from "./assets/qm3.gif";
import qm4 from "./assets/qm4.gif";
import qm5 from "./assets/qm5.gif";
import qm6 from "./assets/qm6.gif";
import qm7 from "./assets/qm7.gif";
import qm8 from "./assets/qm8.gif";
import qm9 from "./assets/qm9.gif";
import qm10 from "./assets/qm10.gif";

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

export const questionMarkImages = {
    qm1,
    qm2,
    qm3,
    qm4,
    qm5,
    qm6,
    qm7,
    qm8,
    qm9,
    qm10,
} as const;