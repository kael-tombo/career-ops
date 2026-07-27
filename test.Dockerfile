FROM node:22-bookworm-slim
RUN echo 'build ok'
CMD ["node", "-e", "console.log('hello')"]
