// Copyright (c) 2016 Esri Japan

import React from 'react';
import { Navbar, Nav, NavItem, NavDropdown, MenuItem, Grid, Row, Col, Glyphicon } from 'react-bootstrap';

import LoadPage from './LoadPage';
import SelectSpotTypePage from './SelectSpotTypePage';
import MapPage from './MapPage';
import PhotoPage from './PhotoPage';
import SpotFormPage from './SpotFormPage';

import { Mediator } from '../';

import turf from 'turf';

import appConfig from './config';

class App extends Mediator {
  constructor (props) {
      super(props);

      // ユーザーの状態
      this.state.userCurrentPosition = appConfig.map.default.center;

      // 読み込み画面の状態
      this.state.loadPageVisibility = true;

      // スポットタイプ選択画面の状態
      this.state.selectSpotTypePageVisibility = false;

      // 写真・くじらんページの状態
      this.state.photoPageVisibility = false;
      this.state.photoPageSearchRadius = appConfig.photoSearch.radius.walk;
      this.state.photoPageSearchEndpointUrl = appConfig.photoSearch.endpointUrl;
      this.state.photoPage2Visibility = false;
      this.state.photoPage2SearchEndpointUrl = appConfig.photoSearch2.endpointUrl;
      this.state.travelMode = 0; // 0: walk, 1: car
      this.state.savedRoute = false;

      // 地図ページの状態
      this.state.mapPageVisibility = false;
      this.state.mapPageRoute = false;
      this.state.mapPageRouteTime = 0;
      this.state.mapPageRouteDistance = 0;
      this.state.mapPageDestination = '';
      this.state.mapPageTravelMode = 0;
      this.state.mapPageKujiranCount = 0;
      this.state.mapPageYorimichiCount = 0;
      this.state.mapPageYorimichiAlertVisibility = false;
      this.state.mapPageDestinationPhoto = 'img/blank.png';

      // 写真スポット投稿ページの状態
      this.state.spotformPageVisibility = false;
      this.state.spotformPageUrl = appConfig.spotformApp.url;

      // くじらんスポット投稿ページの状態
      this.state.kujiranformPageVisibility = false;
      this.state.kujiranformPageUrl = appConfig.kujiranformApp.url;

      // 現在位置アイコン
      this.userIcon = L.vectorIcon({
        className: 'user-icon',
        svgHeight: 48,
        svgWidth: 48,
        type: 'circle',
        shape: {
          r: '6',
          cx: '24',
          cy: '24'
        },
        style: {
          fill: '#006ad1',
          stroke: 'none',
          strokeWidth: 1
        }
      });
      // 現在位置アイコン（レーダーっぽい表現）
      this.userIconBorder = L.vectorIcon({
        className: 'user-icon-border',
        svgHeight: 48,
        svgWidth: 48,
        type: 'circle',
        shape: {
          r: '6',
          cx: '24',
          cy: '24'
        },
        style: {
          fill: '#1e90ff',
          stroke: '#1e90ff',
          strokeWidth: 0.5
        }
      });
      // 現在位置用レイヤー
      this.userLayer = L.featureGroup([]);
      // ルートのスタイル
      this.routeStyle = appConfig.route.style;
      // ルート表示用レイヤー
      this.routeLayer = null;
      // 写真スポットレイヤー（ルートビュー数の更新にのみ使用）
      this.photospotLayer = L.esri.featureLayer({ url: this.state.photoPageSearchEndpointUrl });
      // 選択した写真データ
      this.selectedPhoto = null;
      // 寄り道スポットデータ
      this.yorimichiSpots = [];
      // アクセストークン
      this.token = null;
      // 最初の現在位置取得かを判別するフラグ
      this.firstGeolocationDone = false;

      // this バインド地獄（アローファンクション使いたい）
      this.updateRouteViewCount = this.updateRouteViewCount.bind(this);
      this.onSelectPhoto = this.onSelectPhoto.bind(this);
      this.onLoadPhotos = this.onLoadPhotos.bind(this);
      this.onLoadPhotos2 = this.onLoadPhotos2.bind(this);
      this.onChangeSwitch = this.onChangeSwitch.bind(this);
      this.getRoute = this.getRoute.bind(this);
      this.countKujiran = this.countKujiran.bind(this);
      this.showSelectSpotTypePage = this.showSelectSpotTypePage.bind(this);
      this.showMapPage = this.showMapPage.bind(this);
      this.showPhotoPage = this.showPhotoPage.bind(this);
      this.showPhotoPage2 = this.showPhotoPage2.bind(this);
      this.showSpotFormPage = this.showSpotFormPage.bind(this);
      this.showKujiranFormPage = this.showKujiranFormPage.bind(this);
      this.hideLoadPage = this.hideLoadPage.bind(this);
      this.findYorimichiSpots = this.findYorimichiSpots.bind(this);
      this.onClickYorimichiYesButton = this.onClickYorimichiYesButton.bind(this);
      this.showYorimichiAlert = this.showYorimichiAlert.bind(this);
      this.hideYorimichiAlert = this.hideYorimichiAlert.bind(this);
      this.setMapviewToLocation = this.setMapviewToLocation.bind(this);
  }

  // Mediator のメソッド：マップの初期化が完了
  readyComponents () {
    // Leaflet マップのサイズ調整
    const map = this.state.map;
    map.invalidateSize(true);

    // 現在位置表示用のレイヤーをマップに追加
    this.userLayer.addTo(map);

    // LocalStorage に保存されたルートの確認
    const routeInfoString = this.loadRoute();
    if (routeInfoString !== null) {
      const routeInfo = JSON.parse(routeInfoString);
      this.setState({
        savedRoute: true
      });
      this.getRoute(routeInfo.routes, routeInfo.destination, routeInfo.destinationPhoto, false);
      setTimeout(function () {
        this.setState({ savedRoute: false });
      }.bind(this), 15000);
    }

    if (appConfig.map.geolocation === true) {
      let location = [];
      if (navigator.geolocation) {
        navigator.geolocation.watchPosition(this.getGeolocation.bind(this), this.errorGeolocation.bind(this));
      } else {
        alert('現在地を取得できません');
      }
    } else {
      const dammyPosition = {
        coords: {
          latitude: this.state.userCurrentPosition[0],
          longitude: this.state.userCurrentPosition[1]
        }
      };
      this.getGeolocation(dammyPosition);
    }
  }

  // 現在位置ボタンのクリックイベント
  setMapviewToLocation () {
    const map = this.state.map;
    map.setView(this.state.userCurrentPosition);
  }

  // 現在位置の設定
  getGeolocation (position) {
    console.log('App.geoGeolocation: ', position);
    const map = this.state.map;
    const userCurrentPosition = [position.coords.latitude, position.coords.longitude];
    console.log('App.geoGeolocation.userCurrentPosition: ', userCurrentPosition);

    // 地図を現在地へ移動
    if (this.firstGeolocationDone === false) {
      map.setView(userCurrentPosition);
      this.firstGeolocationDone = true;
    }

    // 現在位置の更新のためマーカーを消去
    this.userLayer.clearLayers();

    // 現在位置マーカーの追加
    const userIcon = this.userIcon;
    const userIconBorder = this.userIconBorder;
    const userMarker = L.marker(userCurrentPosition, {
      icon: userIcon
    });
    const userBorderMarker = L.marker(userCurrentPosition, {
      icon: userIconBorder
    });
    this.userLayer.addLayer(userBorderMarker);
    this.userLayer.addLayer(userMarker);

    this.setState({
      userCurrentPosition: userCurrentPosition
    });
  }

  // 現在位置取得のエラー処理
  errorGeolocation () {
    alert('現在地を取得できません');
  }

  // ルートビュー数の更新
  updateRouteViewCount (data) {
    // ルートビュー数の値を加算してフィーチャサービスを更新
    data.properties[appConfig.photoSearch.routeViewCountField] += 1;
    this.photospotLayer.updateFeature(data, function (response) {
      console.log(response);
    });
  }

  // ユーザーログイン認証
  oauth (data, imgUrl) {
    const protocol = window.location.protocol;
    const host = window.location.host;
    const pathname = window.location.pathname;
    const callbackPage = protocol + '//' + host + pathname + 'oauth/callback.html';

    // OAuth 認証後に実行
    window.oauthCallback = function (token) {
      this.token = token;
      this.onSelectPhoto(data, imgUrl);
    }.bind(this);

    window.open('https://www.arcgis.com/sharing/oauth2/authorize?client_id=' + appConfig.oauth.appid + '&response_type=token&expiration=20160&redirect_uri=' + window.encodeURIComponent(callbackPage), 'oauth', 'height=400,width=600,menubar=no,location=yes,resizable=yes,scrollbars=yes,status=yes');
  }

  // 写真の選択（ルート検索開始ボタンをクリック後に実行）
  onSelectPhoto (data, imgUrl) {
    // アプリ認証を使わない場合はユーザーログイン認証を実施
    if (appConfig.oauth.appLogin === false && this.token === null) {
      this.oauth(data, imgUrl);
    }
    else {
      console.log(data);
      const routeEndpointUrl = appConfig.route.endpointUrl;
      const photoSpotLocation = data.geometry.coordinates;
      const userLocation = [this.state.userCurrentPosition[1], this.state.userCurrentPosition[0]];
      let routeParams;

      this.selectedPhoto = data;

      // ルートビュー数の更新
      this.updateRouteViewCount(data);

      // トラベルモードの設定（トラベルモードスイッチの状態で分岐）
      if (this.state.travelMode === 1) {
        routeParams = {
          stops: userLocation[0] + ',' + userLocation[1] + '; ' + photoSpotLocation[0] + ',' + photoSpotLocation[1]
        }
      } else if (this.state.travelMode === 0) {
        routeParams = {
          stops: userLocation[0] + ',' + userLocation[1] + '; ' + photoSpotLocation[0] + ',' + photoSpotLocation[1],
          travelMode: '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Walking","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Preferred for Pedestrians","value":"PREFER_LOW"},{"parameterName":"Walking Speed (km/h)","attributeName":"WalkTime","value":5},{"parameterName":"Restriction Usage","attributeName":"Avoid Roads Unsuitable for Pedestrians","value":"AVOID_HIGH"}],"description":"Follows paths and roads that allow pedestrian traffic and finds solutions that optimize travel time. The walking speed is set to 5 kilometers per hour.","impedanceAttributeName":"WalkTime","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBAllowBacktrack","restrictionAttributeNames":["Avoid Roads Unsuitable for Pedestrians","Preferred for Pedestrians","Walking"],"useHierarchy":false,"simplificationTolerance":2,"timeAttributeName":"WalkTime","distanceAttributeName":"Kilometers","type":"WALK","id":"caFAgoThrvUpkFBW","name":"Walking Time"}'
        }
      }

      /*const gpService = L.esri.GP.service({
        url: routeEndpointUrl,
        useCors: false
      });
      const gpTask = gpService.createTask();
      gpTask.setParam('stops', userLocation[0] + ',' + userLocation[1] + '; ' + photoSpotLocation[0] + ',' + photoSpotLocation[1]);
      gpTask.run(this.getRoute.bind(this));*/

      // アクセストークンの付与
      if (this.token !== null) {
        routeParams.token = this.token;
      }

      // ルート検索の実行
      L.esri.request(routeEndpointUrl + '/solve', routeParams, function(error, response) {
        if(error){
          console.log(error);
        } else {
          this.getRoute(response.routes, data.properties[appConfig.photoSearch.titleField], imgUrl, true);
        }
      }.bind(this));

      // 地図ページへ表示切替
      this.showMapPage();
    }
  }

  // 写真ページのすべての写真が読み込まれた時点で実行
  onLoadPhotos (initialLoad) {
    if (initialLoad === true) {
      // 読み込み画面を非表示
      this.hideLoadPage();
    }
  }

  onLoadPhotos2 (initialLoad) {
    
  }

  // トラベルモードスイッチの切り替え時に実行
  onChangeSwitch (element, state) {
    console.log('App.onChangeSwitch: ', element, state);
    // 切り替え後のトラベルモードスイッチの状態で分岐（写真スポット取得範囲とトラベルモードの設定）
    if (state === true) {
      // 徒歩モード
      this.setState({
        photoPageSearchRadius: appConfig.photoSearch.radius.walk,
        travelMode: 0
      });
    } else {
      // 自動車モード
      this.setState({
        photoPageSearchRadius: appConfig.photoSearch.radius.car,
        travelMode: 1
      });
    }
  }

  // ルートバッファーに含まれるくじらん数のカウント
  countKujiran (routeBuffer, mapPageStates) {
    // くじらん検索クエリの初期化
    const kujiranQuery = L.esri.query({
      url: appConfig.kujiran.endpointUrl
    });
    kujiranQuery.within(routeBuffer); // ルートバッファーに含まれるフィーチャを検索
    // 条件に合致したフィーチャの数のみを取得
    kujiranQuery.count(function(error, count, response){
      console.log('App.countKujiran ' + count);
      mapPageStates.mapPageKujiranCount = count;
      this.setState(mapPageStates);
    }.bind(this));
  }

  // ルートバッファーに含まれる寄り道スポット（観光スポット）の検索
  findYorimichiSpots (routeBuffer) {
    // 寄り道スポット検索クエリの初期化
    const yorimichiSpotsQuery = L.esri.query({
      url: appConfig.yorimichiSpot.endpointUrl
    });
    yorimichiSpotsQuery.within(routeBuffer); // ルートバッファーに含まれるフィーチャを検索
    // 条件に合致したフィーチャを取得
    yorimichiSpotsQuery.run(function(error, featureCollection, response){
      console.log('App.findYorimichiSpots: ' + featureCollection.features);
      if (featureCollection.features.length > 0) {
        const count = featureCollection.features.length;
        this.yorimichiSpots = featureCollection.features;
        this.showYorimichiAlert(count);
      }
    }.bind(this));
  }

  // [寄り道する]ボタンのクリック時に実行
  onClickYorimichiYesButton () {
    const routeEndpointUrl = appConfig.route.endpointUrl;
    const photoSpotLocation = this.selectedPhoto.geometry.coordinates;
    const userLocation = [this.state.userCurrentPosition[1], this.state.userCurrentPosition[0]];
    const yorimichiSpotsLocation = this.yorimichiSpots.map(function (y, i) {
      return y.geometry.coordinates[0] + ',' + y.geometry.coordinates[1] + '; ';
    });
    let routeParams;

    // 寄り道案内アラートの非表示
    this.hideYorimichiAlert();

    // 最適ルートとトラベルモードの設定（トラベルモードスイッチの状態で分岐）
    if (this.state.travelMode === 1) {
      routeParams = {
        findBestSequence: true, // 最適な巡回ルート検索
        preserveFirstStop: true, // ルート開始地点の固定
        preserveLastStop: true, // ルート終着地点の固定
        stops: userLocation[0] + ',' + userLocation[1] + '; ' + yorimichiSpotsLocation + photoSpotLocation[0] + ',' + photoSpotLocation[1]
      }
    } else if (this.state.travelMode === 0) {
      routeParams = {
        findBestSequence: true, // 最適な巡回ルート検索
        preserveFirstStop: true, // ルート開始地点の固定
        preserveLastStop: true, // ルート終着地点の固定
        stops: userLocation[0] + ',' + userLocation[1] + '; ' + yorimichiSpotsLocation + photoSpotLocation[0] + ',' + photoSpotLocation[1],
        travelMode: '{"attributeParameterValues":[{"parameterName":"Restriction Usage","attributeName":"Walking","value":"PROHIBITED"},{"parameterName":"Restriction Usage","attributeName":"Preferred for Pedestrians","value":"PREFER_LOW"},{"parameterName":"Walking Speed (km/h)","attributeName":"WalkTime","value":5},{"parameterName":"Restriction Usage","attributeName":"Avoid Roads Unsuitable for Pedestrians","value":"AVOID_HIGH"}],"description":"Follows paths and roads that allow pedestrian traffic and finds solutions that optimize travel time. The walking speed is set to 5 kilometers per hour.","impedanceAttributeName":"WalkTime","simplificationToleranceUnits":"esriMeters","uturnAtJunctions":"esriNFSBAllowBacktrack","restrictionAttributeNames":["Avoid Roads Unsuitable for Pedestrians","Preferred for Pedestrians","Walking"],"useHierarchy":false,"simplificationTolerance":2,"timeAttributeName":"WalkTime","distanceAttributeName":"Kilometers","type":"WALK","id":"caFAgoThrvUpkFBW","name":"Walking Time"}'
      }
    }

    // アクセストークンの付与
    if (this.token !== null) {
      routeParams.token = this.token;
    }

    // ルート検索の実行
    L.esri.request(routeEndpointUrl + '/solve', routeParams, function(error, response) {
      if(error){
        console.log(error);
      } else {
        const selectedPhoto = this.selectedPhoto;
        this.getRoute(response.routes, selectedPhoto.properties[appConfig.photoSearch.titleField], this.state.mapPageDestinationPhoto, false);
      }
    }.bind(this));
  }

  // 寄り道案内アラートの表示
  showYorimichiAlert (count) {
    this.setState({ 
      mapPageYorimichiAlertVisibility: true,
      mapPageYorimichiCount: count
    });
  }

  // 寄り道案内アラートの非表示
  hideYorimichiAlert () {
    this.setState({ mapPageYorimichiAlertVisibility: false });
  }

  // ルート検索結果の表示・保存
  getRoute (routes, destination, destinationPhoto, first) {
    console.log('App.getRoute: ', routes);
    const routeGeoJSON = L.esri.Util.arcgisToGeoJSON(routes.features[0]);
    const routeStyle = this.routeStyle;
    const map = this.state.map;
    let routeTime;
    let travelMode;

    // 到達時間の取得（トラベルモードで分岐）
    if (this.state.travelMode === 0) {
      travelMode = 0;
      if (routeGeoJSON.properties.Total_WalkTime !== undefined) {
        routeTime = Math.round(routeGeoJSON.properties.Total_WalkTime);
      } else if (routeGeoJSON.properties.Total_TravelTime !== undefined) {
        routeTime = Math.round(routeGeoJSON.properties.Total_TravelTime);
        travelMode = 1;
      }
    } else if (this.state.travelMode === 1) {
      travelMode = 1;
      if (routeGeoJSON.properties.Total_TravelTime !== undefined) {
        routeTime = Math.round(routeGeoJSON.properties.Total_TravelTime);
      } else if (routeGeoJSON.properties.Total_WalkTime !== undefined) {
        routeTime = Math.round(routeGeoJSON.properties.Total_WalkTime);
        travelMode = 0;
      }
    }

    // 地図ページの更新内容
    const mapPageStates = {
      mapPageRoute: true,
      mapPageRouteTime: routeTime,
      mapPageRouteDistance: Math.round(routeGeoJSON.properties.Total_Kilometers * 100) / 100,
      mapPageDestination: destination,
      mapPageTravelMode: travelMode,
      mapPageDestinationPhoto: destinationPhoto
    };

    // ルートバッファー
    const routeBuffer = turf.buffer(routeGeoJSON, appConfig.route.bufferRadius, 'meters');
    // ルートバッファーに含まれるくじらん数のカウント
    this.countKujiran(routeBuffer, mapPageStates);

    // 写真選択によるルート実行の場合にのみ実行
    if (first === true) {
      // ルートバッファーに含まれる寄り道スポットの検索
      this.findYorimichiSpots(routeBuffer);
    }

    // ルート表示用レイヤーの更新
    if (this.routeLayer !== null) {
      this.routeLayer.clearLayers();
    } else {
      this.routeLayer = L.geoJson(null, {
        onEachFeature: function (feature, layer) {
          map.fitBounds(layer.getBounds());
        },
        style: function (feature) {
          return routeStyle;
        }
      });
      this.routeLayer.addTo(map);
    }
    this.routeLayer.addData(routeGeoJSON);

    // ルートの保存（LocalStorage）
    this.saveRoute(routes, destination, destinationPhoto);
  }

  // ルートの保存（LocalStorage）
  saveRoute (routes, destination, destinationPhoto) {
    const routeInfo = {
      routes: routes,
      destination: destination,
      destinationPhoto: destinationPhoto
    };
    const routeInfoString = JSON.stringify(routeInfo); // ルートと目的地のオブジェクトを文字列に変換
    localStorage.setItem('photospot-finder-route', routeInfoString);
  }

  // 保存ルート（LocalStorage）の参照
  loadRoute () {
    console.log('App.loadRoute', localStorage.getItem('photospot-finder-route'));

    const routeInfoString = localStorage.getItem('photospot-finder-route');
    
    return routeInfoString;
  }

  // 地図ページへの表示切替
  showMapPage () {
    this.setState({
      selectSpotTypePageVisibility: false,
      photoPageVisibility: false,
      photoPage2Visibility: false,
      mapPageVisibility: true,
      spotformPageVisibility: false,
      kujiranformPageVisibility: false
    });
    const map = this.state.map;
    map.invalidateSize(true);
    setTimeout(function () {map.invalidateSize(true);}, 2000);
  }

  // 写真ページへの表示切替
  showPhotoPage () {
    this.setState({
      selectSpotTypePageVisibility: false,
      photoPageVisibility: true,
      photoPage2Visibility: false,
      mapPageVisibility: false,
      spotformPageVisibility: false,
      kujiranformPageVisibility: false
    });
  }

  // 写真ページ2への表示切替
  showPhotoPage2 () {
    this.setState({
      selectSpotTypePageVisibility: false,
      photoPageVisibility: false,
      photoPage2Visibility: true,
      mapPageVisibility: false,
      spotformPageVisibility: false,
      kujiranformPageVisibility: false
    });
  }

  // 写真スポット投稿ページへの表示切替
  showSpotFormPage () {
    this.setState({
      selectSpotTypePageVisibility: false,
      photoPageVisibility: false,
      photoPage2Visibility: false,
      mapPageVisibility: false,
      spotformPageVisibility: true,
      kujiranformPageVisibility: false
    });
  }

  // くじらんスポット投稿ページへの表示切替
  showKujiranFormPage () {
    this.setState({
      selectSpotTypePageVisibility: false,
      photoPageVisibility: false,
      photoPage2Visibility: false,
      mapPageVisibility: false,
      spotformPageVisibility: false,
      kujiranformPageVisibility: true
    });
  }

  // スポットタイプ選択画面の表示
  showSelectSpotTypePage () {
    this.setState({
      loadPageVisibility: false,
      selectSpotTypePageVisibility: true,
      photoPageVisibility: false,
      photoPage2Visibility: false,
      mapPageVisibility: false,
      spotformPageVisibility: false
    });
  }

  // 読み込み画面の表示
  showLoadPage () {
    this.setState({
      loadPageVisibility: true,
      selectSpotTypePageVisibility: false,
      photoPageVisibility: false,
      photoPage2Visibility: false,
      mapPageVisibility: false,
      spotformPageVisibility: false
    });
  }

  // 読み込み画面の非表示
  hideLoadPage () {
    this.setState({
      loadPageVisibility: false,
      selectSpotTypePageVisibility: true
    });
  }

  componentWillMount () {
    /*if (appConfig.map.geolocation === true) {
      let location = [];
      if (navigator.geolocation) {
        navigator.geolocation.watchPosition(this.getGeolocation.bind(this), this.errorGeolocation.bind(this));
      } else {
        alert('現在地を取得できません');
      }
    }*/
  }

  componentDidUpdate (prevProps, prevState) {
    if (this.state.isLoaded.webmap === true && prevState.isLoaded.webmap === false) {
      console.log('react-webmap: ready components!');
      this.readyComponents();
    }
  }

  render () {
    return (
      <div>
        <style type="text/css">{`
        html, body {
          background-color: #222;
        }
        .fixed-nav {
            position: fixed;
            width: 100%;
            z-index: 99998;
        }
        .offset-top {
            margin-top: 51px;
        }
        div.leaflet-esri-webmap-layer2-label-pane > div.esri-leaflet-webmap-labels {
          margin-left: 0 !important;
          margin-top: -9px !important;
          color: rgb(255,127,127) !important;
        }
        .route-path {
          -webkit-animation: dash 10s linear forwards;
          animation: dash 10s linear forwards;
        }
        @-webkit-keyframes dash {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes dash {
          to {
            stroke-dashoffset: 0;
          }
        }
        .user-icon-border > svg > g > circle {
          -webkit-animation-duration: 3s;
          -webkit-animation-name: pulse;
          -webkit-animation-iteration-count: infinite;
          animation-duration: 3s;
          animation-name: pulse;
          animation-iteration-count: infinite;
          fill-opacity: 0.3;
        }
        @-webkit-keyframes pulse {
          0% {
            transform-origin: 50% 50%;
            transform: scale(1,1);
            opacity: 1;
          }
          100% {
            transform-origin: 50% 50%;
            transform: scale(3,3);
            opacity: 0.5;
          }
        }
        @keyframes pulse {
          0% {
            transform-origin: 50% 50%;
            transform: scale(1,1);
            opacity: 1;
          }
          100% {
            transform-origin: 50% 50%;
            transform: scale(3,3);
            opacity: 0.5;
          }
        }
        `}</style>
        <Navbar inverse className="fixed-nav">
          <Navbar.Header>
            <Navbar.Brand>
              <a href="#"><img src={appConfig.ui.iconUrl} style={{ position: 'absolute', width: '42px', marginTop: '-8px' }} /> <span style={{ color: '#fff', fontWeight: 'bold', marginLeft: '56px' }}>{appConfig.ui.title}</span> {appConfig.ui.subtitle}</a>
            </Navbar.Brand>
            <Navbar.Toggle />
          </Navbar.Header>
          <Navbar.Collapse>
            <Nav>
              <NavItem eventKey={1} href="#" onClick={this.showPhotoPage}><Glyphicon glyph="picture" /> 撮影スポットの写真</NavItem>
              <NavItem eventKey={2} href="#" onClick={this.showPhotoPage2}><Glyphicon glyph="picture" /> くじらんスポットの写真</NavItem>
              <NavItem eventKey={3} href="#" onClick={this.showMapPage}><Glyphicon glyph="map-marker" /> 地図</NavItem>
              <NavItem eventKey={4} href="#" onClick={this.showSpotFormPage}><Glyphicon glyph="send" /> 撮影スポットの投稿</NavItem>
              <NavItem eventKey={5} href="#" onClick={this.showKujiranFormPage}><Glyphicon glyph="send" /> くじらんスポットの投稿</NavItem>
              <NavItem eventKey={6} href="https://github.com/EsriJapan/photospot-finder">GitHub (外部リンク)</NavItem>
            </Nav>
          </Navbar.Collapse>
        </Navbar>
        <Grid className="main-contents">
          <Row className="offset-top">
            <Col xs={12} md={12}>
              <LoadPage 
                visibility={this.state.loadPageVisibility} 
              />
              <SelectSpotTypePage 
                visibility={this.state.selectSpotTypePageVisibility} 
                onSelectPhotoSpot={this.showPhotoPage} 
                onSelectKujiranSpot={this.showPhotoPage2} 
              />
              <PhotoPage 
                visibility={this.state.photoPageVisibility} 
                searchRadius={this.state.photoPageSearchRadius} 
                location={this.state.userCurrentPosition} 
                searchEndpointUrl={this.state.photoPageSearchEndpointUrl} 
                onSelectPhoto={this.onSelectPhoto} 
                onLoadPhotos={this.onLoadPhotos} 
                onChangeSwitch={this.onChangeSwitch} 
                hasSavedRoute={this.state.savedRoute} 
                onClickSavedRouteShowButton={this.showMapPage} 
                photoSearchConfig={appConfig.photoSearch} 
                travelMode={this.state.travelMode} 
              />
              <PhotoPage 
                visibility={this.state.photoPage2Visibility} 
                searchRadius={this.state.photoPageSearchRadius} 
                location={this.state.userCurrentPosition} 
                searchEndpointUrl={this.state.photoPage2SearchEndpointUrl} 
                onSelectPhoto={this.onSelectPhoto} 
                onLoadPhotos={this.onLoadPhotos2} 
                onChangeSwitch={this.onChangeSwitch} 
                hasSavedRoute={this.state.savedRoute} 
                onClickSavedRouteShowButton={this.showMapPage}  
                photoSearchConfig={appConfig.photoSearch2} 
                travelMode={this.state.travelMode} 
              />
              <MapPage 
                visibility={this.state.mapPageVisibility} 
                mapid={this.props.mapid} 
                route={this.state.mapPageRoute} 
                routeTime={this.state.mapPageRouteTime} 
                routeDistance={this.state.mapPageRouteDistance} 
                destination={this.state.mapPageDestination} 
                travelMode={this.state.mapPageTravelMode} 
                destinationPhoto={this.state.mapPageDestinationPhoto} 
                kujiranCount={this.state.mapPageKujiranCount} 
                yorimichiCount={this.state.mapPageYorimichiCount} 
                yorimichiAlertVisibility={this.state.mapPageYorimichiAlertVisibility} 
                onClickYorimichiYesButton={this.onClickYorimichiYesButton} 
                onClickYorimichiNoButton={this.hideYorimichiAlert} 
                onClickLocationButton={this.setMapviewToLocation} 
              />
              <SpotFormPage 
                visibility={this.state.spotformPageVisibility} 
                url={this.state.spotformPageUrl} 
              />
              <SpotFormPage 
                visibility={this.state.kujiranformPageVisibility} 
                url={this.state.kujiranformPageUrl} 
              />
            </Col>
          </Row>
        </Grid>
      </div>
    );
  }
}

App.displayName = 'App';

export default App;
