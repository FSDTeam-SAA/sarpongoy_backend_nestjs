import { HttpException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './entities/user.entity';
import { Model } from 'mongoose';
import { fileUpload } from 'src/app/helpers/fileUploder';
import { IFilterParams } from 'src/app/helpers/pick';
import paginationHelper, { IOptions } from 'src/app/helpers/pagenation';
import buildWhereConditions from 'src/app/helpers/buildWhereConditions';
import sendMailer from 'src/app/helpers/sendMailer';
import { generateWelcomeEmail } from 'src/app/utils/generateWelcomeEmail';

const userSearchAbleFields = [
  'fullName',
  'email',
  'role',
  'gender',
  'phoneNumber',
  'country',
  'city',
  'address',
  'status',
];

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async createUser(
    createUserDto: CreateUserDto,
    files?: {
      schoolLogo?: Express.Multer.File[];
      uploadeSignature?: Express.Multer.File[];
      profilePicture?: Express.Multer.File[];
    },
  ) {
    const user = await this.userModel.findOne({ email: createUserDto.email });
    if (user) {
      throw new HttpException('User already exists', 400);
    }
    if (files?.schoolLogo?.length) {
      const uploadedFile = await fileUpload.uploadToCloudinary(
        files.schoolLogo[0],
      );
      createUserDto.schoolLogo = uploadedFile.url;
    }
    if (files?.uploadeSignature?.length) {
      const uploadedFile = await fileUpload.uploadToCloudinary(
        files.uploadeSignature[0],
      );
      createUserDto.uploadeSignature = uploadedFile.url;
    }
    if (files?.profilePicture?.length) {
      const uploadedFile = await fileUpload.uploadToCloudinary(
        files.profilePicture[0],
      );
      createUserDto.profilePicture = uploadedFile.url;
    }
    const createdUser = await this.userModel.create(createUserDto);
    await sendMailer(
      createdUser.email,
      'Welcome to our platform',
      generateWelcomeEmail(createUserDto.email, createUserDto.password),
    );
    return createdUser;
  }

  async getAllUser(params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);
    const whereConditions = buildWhereConditions(params, userSearchAbleFields);

    const total = await this.userModel.countDocuments(whereConditions);
    const users = await this.userModel
      .find(whereConditions)
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder } as any);

    return {
      meta: {
        page,
        limit,
        total,
      },
      data: users,
    };
  }

  async getSingleUser(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new HttpException('User not found', 404);
    }
    return user;
  }

  async updateUser(
    id: string,
    updateUserDto: UpdateUserDto,
    files?: {
      schoolLogo?: Express.Multer.File[];
      uploadeSignature?: Express.Multer.File[];
      profilePicture?: Express.Multer.File[];
    },
  ) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new HttpException('User not found', 404);
    }
    if (files?.schoolLogo?.length) {
      const uploadedFile = await fileUpload.uploadToCloudinary(
        files.schoolLogo[0],
      );
      updateUserDto.schoolLogo = uploadedFile.url;
    }
    if (files?.uploadeSignature?.length) {
      const uploadedFile = await fileUpload.uploadToCloudinary(
        files.uploadeSignature[0],
      );
      updateUserDto.uploadeSignature = uploadedFile.url;
    }
    if (files?.profilePicture?.length) {
      const uploadedFile = await fileUpload.uploadToCloudinary(
        files.profilePicture[0],
      );
      updateUserDto.profilePicture = uploadedFile.url;
    }
    const updatedUser = await this.userModel.findByIdAndUpdate(
      id,
      updateUserDto,
      { new: true },
    );
    return updatedUser;
  }

  async deleteUser(id: string) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new HttpException('User not found', 404);
    }
    const result = await this.userModel.findByIdAndDelete(id);
    return result;
  }

  async getProfile(id: string) {
    const result = await this.userModel.findById(id);
    if (!result) {
      throw new HttpException('User not found', 404);
    }
    return result;
  }

  async updateMyProfile(
    id: string,
    updateUserDto: UpdateUserDto,
    files?: {
      schoolLogo?: Express.Multer.File[];
      uploadeSignature?: Express.Multer.File[];
      profilePicture?: Express.Multer.File[];
    },
  ) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new HttpException('User not found', 404);
    }

    if (files?.schoolLogo?.length) {
      const uploaded = await fileUpload.uploadToCloudinary(files.schoolLogo[0]);
      updateUserDto.schoolLogo = uploaded.url;
    }

    if (files?.uploadeSignature?.length) {
      const uploaded = await fileUpload.uploadToCloudinary(
        files.uploadeSignature[0],
      );
      updateUserDto.uploadeSignature = uploaded.url;
    }

    if (files?.profilePicture?.length) {
      const uploaded = await fileUpload.uploadToCloudinary(
        files.profilePicture[0],
      );
      updateUserDto.profilePicture = uploaded.url;
    }
    const result = await this.userModel.findByIdAndUpdate(id, updateUserDto, {
      new: true,
    });

    return result;
  }
}
