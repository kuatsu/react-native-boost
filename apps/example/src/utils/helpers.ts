import { BenchmarkStep } from '../types';

export const getMarkerName = (title: string, step: BenchmarkStep) => `${title}-${step}`;
