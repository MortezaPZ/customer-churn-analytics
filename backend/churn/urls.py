from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DatasetViewSet, TrainingRunViewSet, overview

router = DefaultRouter()
router.register('datasets', DatasetViewSet, basename='dataset')
router.register('runs', TrainingRunViewSet, basename='run')

urlpatterns = [
    path('overview/', overview, name='overview'),
    path('', include(router.urls)),
]
