// Copyright (c) 2016 Yusuke Nunokawa (https://ynunokawa.github.io)
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import React from 'react';
import { Label, Glyphicon } from 'react-bootstrap';

class PhotoLayout extends React.Component {
  constructor (props) {
      super(props);
      this._onSelectPhoto = this._onSelectPhoto.bind(this);
  }

  _onSelectPhoto () {
    this.props.onSelectPhoto(this.props.data);
  }

  render () {
    let NewLabel = null;
    let routeViewCount = this.props.routeViewCount;
    const date = new Date();
    const now = date.getTime();
    const def = now - this.props.time;

    console.log(this.props.title, def);
    
    if (def < 86400000) {
      NewLabel = (<Label bsStyle="danger">New</Label>);
    }
    if (routeViewCount === null || routeViewCount === undefined) {
      routeViewCount = 0;
    }

    return (
      <div className="murophoto-frame">
        <img src={this.props.imgUrl} className="murophoto" />
        <h5>{this.props.title}</h5>
        <p>by. {this.props.name}</p>
        <div className="route-view-count"><Glyphicon glyph="eye-open" /> {routeViewCount} {NewLabel}</div>
        <div className="to-route" onClick={this._onSelectPhoto}><Glyphicon glyph="globe" /> ルート検索を開始する</div>
      </div>
    );
  }
}

PhotoLayout.propTypes = {
  imgUrl: React.PropTypes.string,
  name: React.PropTypes.string,
  title: React.PropTypes.string,
  comment: React.PropTypes.string,
  time: React.PropTypes.number,
  data: React.PropTypes.object,
  routeViewCount: React.PropTypes.number,
  onSelectPhoto: React.PropTypes.func
};

PhotoLayout.displayName = 'PhotoLayout';

export default PhotoLayout;