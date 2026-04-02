# Google Avatar Frame Generator

Bring the iconic Google profile ring to any avatar.

When we use Google products, our profile photos often get wrapped in that recognizable four-color Google ring. It makes a plain avatar feel brighter, cleaner, and much more distinctive. The problem is that we usually cannot download the avatar together with the ring and reuse it on other platforms.

That is exactly why this tool exists.

## What This Project Does

This project helps you generate a Google-style avatar locally or directly in the browser:

- Upload an image and turn it into a framed avatar with the signature Google color ring
- Support both static images and animated GIF files
- Keep the calibrated ring proportions and segment positions
- Export the result as a PNG or animated GIF
- Use it online or run it from source locally

## Try It Online

You can use the web version here:

[https://2010384626.github.io/Google-Avatar-Frame-Generator/](https://2010384626.github.io/Google-Avatar-Frame-Generator/)

The online version runs entirely in the browser, so it is quick and easy to use.

## Run It Locally

If you want to use the source code locally, clone or download this repository and install the required dependency listed in [requirements.txt](requirements.txt).

### Install

```bash
pip install -r requirements.txt
```

### Python Script

```bash
python google_avatar_frame.py
```

You can also pass an input image path directly:

```bash
python google_avatar_frame.py your_avatar.jpg -o result.png
```

## Project Files

- `index.html`, `style.css`, `script.js`: GitHub Pages web app
- `google_avatar_frame.py`: local Python version
- `requirements.txt`: Python dependency list

## Why It Exists

This is a small utility built for a very practical reason: sometimes we just want to keep the colorful Google avatar look and use it somewhere else.

If that sounds useful to you, open the online app and try it with your own profile photo.

## Thanks to Linux Do

This forum has been a great help to me; I welcome everyone to browse and join.

linux.do
