from django.http import JsonResponse
from django.urls import path
from prauga_flexdoc import django_urlpatterns


def openapi(request):
    return JsonResponse({
        'openapi': '3.1.0',
        'info': {'title': 'Django FlexDoc Example', 'version': '1.0.0'},
        'paths': {'/health': {'get': {'responses': {'200': {'description': 'OK'}}}}},
    })


def health(request):
    return JsonResponse({'status': 'ok'})


urlpatterns = [
    path('openapi.json', openapi),
    path('health', health),
    *django_urlpatterns('/docs', spec_url='/openapi.json', title='Django FlexDoc Example'),
]
