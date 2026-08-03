export type RiskBand = 'high' | 'medium' | 'low';

export type Algorithm =
  | 'gradient_boosting'
  | 'random_forest'
  | 'logistic_regression';

export interface ColumnProfile {
  name: string;
  type: 'numeric' | 'categorical';
  missing: number;
  min?: number | null;
  max?: number | null;
  mean?: number | null;
  unique?: number;
  top_values?: { value: string; count: number }[];
}

export interface DatasetSchema {
  row_count: number;
  column_count: number;
  churn_rate: number;
  numeric_features: string[];
  categorical_features: string[];
  columns: ColumnProfile[];
}

export interface Dataset {
  id: number;
  name: string;
  target_column: string;
  row_count: number;
  column_count: number;
  churn_rate: number;
  run_count: number;
  uploaded_at: string;
  schema?: DatasetSchema;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  std: number;
}

export interface TrainingRun {
  id: number;
  dataset: number;
  dataset_name: string;
  algorithm: Algorithm;
  algorithm_label: string;
  status: 'pending' | 'completed' | 'failed';
  error_message: string;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1_score: number | null;
  roc_auc: number | null;
  confusion_matrix: number[][];
  feature_importances: FeatureImportance[];
  roc_curve: { fpr?: number[]; tpr?: number[] };
  training_seconds: number;
  created_at: string;
}

export interface Segment {
  band: RiskBand;
  customers: number;
  share: number;
  average_probability: number;
}

export interface SegmentReport {
  total_customers: number;
  at_risk: number;
  average_probability: number;
  segments: Segment[];
}

export interface PredictionRow {
  [column: string]: string | number | null;
  churn_probability: number;
  risk_band: RiskBand;
}

export interface PredictionPage {
  count: number;
  results: PredictionRow[];
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
