import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  Algorithm,
  Dataset,
  Paginated,
  PredictionPage,
  SegmentReport,
  TrainingRun,
} from './models';

const BASE_URL = '/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  listDatasets(): Observable<Paginated<Dataset>> {
    return this.http.get<Paginated<Dataset>>(`${BASE_URL}/datasets/`);
  }

  getDataset(id: number): Observable<Dataset> {
    return this.http.get<Dataset>(`${BASE_URL}/datasets/${id}/`);
  }

  uploadDataset(file: File, targetColumn: string): Observable<Dataset> {
    const form = new FormData();
    form.append('file', file);
    form.append('target_column', targetColumn);
    return this.http.post<Dataset>(`${BASE_URL}/datasets/upload/`, form);
  }

  train(datasetId: number, algorithm: Algorithm): Observable<TrainingRun> {
    return this.http.post<TrainingRun>(
      `${BASE_URL}/datasets/${datasetId}/train/`,
      { algorithm },
    );
  }

  listRuns(datasetId?: number): Observable<Paginated<TrainingRun>> {
    const params: Record<string, number> = datasetId ? { dataset: datasetId } : {};
    return this.http.get<Paginated<TrainingRun>>(`${BASE_URL}/runs/`, { params });
  }

  getSegments(runId: number): Observable<SegmentReport> {
    return this.http.get<SegmentReport>(`${BASE_URL}/runs/${runId}/segments/`);
  }

  getPredictions(runId: number, limit = 50): Observable<PredictionPage> {
    return this.http.get<PredictionPage>(`${BASE_URL}/runs/${runId}/predictions/`, {
      params: { limit },
    });
  }
}
